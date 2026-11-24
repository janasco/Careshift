import { and, eq, gte, inArray, lte } from "drizzle-orm";
import {
  calendarEvents,
  caregivers,
  medicationLogs,
  medications,
  pushLogs,
  pushTokens,
  scheduledTasks,
  taskTemplates,
} from "@careshift/db";
import type { Db } from "../db";
import { getDb } from "../db";
import type { Bindings } from "../env";
import { sendPushToUsers, type PushMessage } from "./fcm";

const REMINDER_WINDOW_MS = 10 * 60 * 1000;
const APPOINTMENT_WINDOW_MS = 30 * 60 * 1000;

function timezoneOffset(env: Bindings) {
  const value = Number(env.TIMEZONE_OFFSET_MINUTES ?? 480);
  return Number.isFinite(value) ? value : 480;
}

function localDate(ms: number, offsetMinutes: number) {
  const value = new Date(ms + offsetMinutes * 60_000);
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

function localTime(ms: number, offsetMinutes: number) {
  const value = new Date(ms + offsetMinutes * 60_000);
  const hours = value.getUTCHours();
  const minutes = value.getUTCMinutes();
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function localDueMs(date: string, time: string, offsetMinutes: number) {
  return Date.parse(`${date}T${time}:00Z`) - offsetMinutes * 60_000;
}

async function usersWithTokens(db: Db) {
  const rows = await db
    .select({ userId: pushTokens.userId })
    .from(pushTokens)
    .groupBy(pushTokens.userId);
  return rows.map((row) => row.userId);
}

async function unsentUsers(
  db: Db,
  type: string,
  entityId: string,
  scheduledFor: number,
  userIds: string[],
) {
  if (userIds.length === 0) return [];
  const rows = await db
    .select({ userId: pushLogs.userId })
    .from(pushLogs)
    .where(
      and(
        eq(pushLogs.type, type),
        eq(pushLogs.entityId, entityId),
        eq(pushLogs.scheduledFor, scheduledFor),
        inArray(pushLogs.userId, userIds),
      ),
    );
  const sent = new Set(rows.map((row) => row.userId));
  return userIds.filter((userId) => !sent.has(userId));
}

async function markSent(
  db: Db,
  type: string,
  entityId: string,
  scheduledFor: number,
  userIds: string[],
) {
  if (userIds.length === 0) return;
  await db
    .insert(pushLogs)
    .values(
      userIds.map((userId) => ({
        id: crypto.randomUUID(),
        userId,
        type,
        entityId,
        scheduledFor,
        sentAt: Date.now(),
      })),
    )
    .onConflictDoNothing();
}

async function dispatch(
  env: Bindings,
  db: Db,
  type: string,
  entityId: string,
  scheduledFor: number,
  userIds: string[],
  message: PushMessage,
) {
  const pending = await unsentUsers(db, type, entityId, scheduledFor, userIds);
  if (pending.length === 0) return 0;

  const result = await sendPushToUsers(env, db, pending, message);
  if (result.configured && result.tokenCount > 0) {
    await markSent(db, type, entityId, scheduledFor, pending);
  }
  return result.sent;
}

export async function runPushScheduler(env: Bindings) {
  const db = getDb(env);
  const now = Date.now();
  const offset = timezoneOffset(env);
  const date = localDate(now, offset);
  const recipients = await usersWithTokens(db);
  let sent = 0;

  const appointments = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        gte(calendarEvents.startMs, now),
        lte(calendarEvents.startMs, now + APPOINTMENT_WINDOW_MS),
      ),
    );

  for (const event of appointments) {
    sent += await dispatch(
      env,
      db,
      "appointment",
      event.id,
      event.startMs,
      recipients,
      {
        title: "Appointment soon",
        body: `${event.title} at ${localTime(event.startMs, offset)}${
          event.location ? ` · ${event.location}` : ""
        }`,
        data: { kind: "calendar" },
      },
    );
  }

  const activeMedications = (await db.select().from(medications)).filter(
    (medication) =>
      medication.active &&
      (!medication.startDate || date >= medication.startDate) &&
      (!medication.endDate || date <= medication.endDate),
  );
  const todayLogs = await db
    .select()
    .from(medicationLogs)
    .where(eq(medicationLogs.date, date));

  for (const medication of activeMedications) {
    for (const time of medication.times) {
      const dueMs = localDueMs(date, time, offset);
      if (dueMs < now || dueMs > now + REMINDER_WINDOW_MS) continue;

      const alreadyLogged = todayLogs.some(
        (log) =>
          log.medicationId === medication.id && log.scheduledTime === time,
      );
      if (alreadyLogged) continue;

      sent += await dispatch(
        env,
        db,
        "medication",
        `${medication.id}:${time}`,
        dueMs,
        recipients,
        {
          title: "Medication due soon",
          body: `${medication.name}${
            medication.dosage ? ` ${medication.dosage}` : ""
          } for ${medication.patientName ?? "care recipient"} at ${localTime(
            dueMs,
            offset,
          )}`,
          data: { kind: "medications" },
        },
      );
    }
  }

  const tasks = await db
    .select()
    .from(scheduledTasks)
    .where(
      and(
        eq(scheduledTasks.date, date),
        eq(scheduledTasks.status, "pending"),
        gte(scheduledTasks.dueMs, now),
        lte(scheduledTasks.dueMs, now + REMINDER_WINDOW_MS),
      ),
    );

  if (tasks.length > 0) {
    const caregiverIds = Array.from(new Set(tasks.map((task) => task.caregiverId)));
    const templateIds = Array.from(new Set(tasks.map((task) => task.templateId)));
    const caregiverRows = await db
      .select()
      .from(caregivers)
      .where(inArray(caregivers.id, caregiverIds));
    const templateRows = await db
      .select()
      .from(taskTemplates)
      .where(inArray(taskTemplates.id, templateIds));

    for (const task of tasks) {
      const caregiver = caregiverRows.find((row) => row.id === task.caregiverId);
      if (!caregiver) continue;
      const template = templateRows.find((row) => row.id === task.templateId);

      sent += await dispatch(
        env,
        db,
        "task",
        task.id,
        task.dueMs,
        [caregiver.userId],
        {
          title: "Task due soon",
          body: `${template?.name ?? "Care task"} at ${localTime(
            task.dueMs,
            offset,
          )}`,
          data: { kind: "tasks" },
        },
      );
    }
  }

  console.log("Push scheduler complete", {
    appointments: appointments.length,
    medications: activeMedications.length,
    tasks: tasks.length,
    sent,
  });

  return { sent };
}
