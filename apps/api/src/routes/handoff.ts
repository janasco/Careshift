import { Hono } from "hono";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  careEvents,
  caregivers,
  issues,
  medicationLogs,
  medications,
  patients,
  profiles,
  scheduledTasks,
  vitalSigns,
  visits,
} from "@careshift/db";
import { getDb } from "../db";
import { requireUser } from "../middleware/auth";
import type { Bindings, Variables } from "../env";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", requireUser);

app.get("/", async (c) => {
  const date = c.req.query("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ error: "Invalid date" }, 400);
  }

  const db = getDb(c.env);
  const patientId = c.req.query("patientId");

  const patientRows = patientId
    ? await db.select().from(patients).where(eq(patients.id, patientId)).limit(1)
    : await db
        .select()
        .from(patients)
        .where(eq(patients.status, "active"))
        .limit(1);
  const patient = patientRows[0] ?? null;
  if (!patient) return c.json({ error: "No patient found" }, 404);

  const [latestVitals, recentEvents, medicationRows, logRows, visitRows] =
    await Promise.all([
      db
        .select()
        .from(vitalSigns)
        .where(eq(vitalSigns.patientId, patient.id))
        .orderBy(desc(vitalSigns.createdAt))
        .limit(5),
      db
        .select()
        .from(careEvents)
        .where(eq(careEvents.patientId, patient.id))
        .orderBy(desc(careEvents.createdAt))
        .limit(8),
      db
        .select()
        .from(medications)
        .where(
          and(
            eq(medications.patientId, patient.id),
            eq(medications.active, true),
          ),
        ),
      db.select().from(medicationLogs).where(eq(medicationLogs.date, date)),
      db
        .select({
          id: visits.id,
          caregiverName: profiles.fullName,
          shiftId: visits.shiftId,
          clockInAt: visits.clockInAt,
          clockOutAt: visits.clockOutAt,
          status: visits.status,
          clockInNotes: visits.clockInNotes,
          clockOutNotes: visits.clockOutNotes,
        })
        .from(visits)
        .leftJoin(caregivers, eq(caregivers.id, visits.caregiverId))
        .leftJoin(profiles, eq(profiles.userId, caregivers.userId))
        .where(eq(visits.date, date))
        .orderBy(desc(visits.clockInAt))
        .limit(1),
    ]);

  const activeMeds = medicationRows.filter(
    (med) =>
      (!med.startDate || date >= med.startDate) &&
      (!med.endDate || date <= med.endDate),
  );

  const medsWithDoses = activeMeds.map((med) => ({
    id: med.id,
    name: med.name,
    dosage: med.dosage,
    route: med.route,
    instructions: med.instructions,
    times: med.times,
    doses: med.times.map((time) => ({
      time,
      log:
        logRows.find(
          (row) => row.medicationId === med.id && row.scheduledTime === time,
        ) ?? null,
    })),
  }));

  const tasks = await db
    .select({ id: scheduledTasks.id })
    .from(scheduledTasks)
    .where(
      and(
        eq(scheduledTasks.patientId, patient.id),
        eq(scheduledTasks.date, date),
      ),
    );
  const taskIds = tasks.map((task) => task.id);
  const openIssues =
    taskIds.length > 0
      ? await db
          .select()
          .from(issues)
          .where(
            and(
              eq(issues.status, "open"),
              inArray(issues.scheduledTaskId, taskIds),
            ),
          )
      : [];

  const visit = visitRows[0]
    ? {
        ...visitRows[0],
        durationMs:
          (visitRows[0].clockOutAt ?? Date.now()) - visitRows[0].clockInAt,
      }
    : null;

  return c.json({
    date,
    patient: {
      id: patient.id,
      fullName: patient.fullName,
      preferredName: patient.preferredName,
      room: patient.room,
      notes: patient.notes,
    },
    latestVitals,
    recentEvents,
    medications: medsWithDoses,
    visit,
    openIssues,
  });
});

export default app;
