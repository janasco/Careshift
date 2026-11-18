import { Hono } from "hono";
import { and, eq, gte, lte } from "drizzle-orm";
import {
  caregivers,
  profiles,
  scheduledTasks,
  shifts,
  taskTemplates,
} from "@careshift/db";
import { getDb } from "../db";
import { requireAdmin, requireUser } from "../middleware/auth";
import type { Bindings, Variables } from "../env";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", requireUser);
app.use("*", requireAdmin);

app.get("/daily", async (c) => {
  const date = c.req.query("date");
  if (!date) return c.json({ error: "date is required" }, 400);

  const db = getDb(c.env);
  const now = Date.now();
  const tasks = await db
    .select()
    .from(scheduledTasks)
    .where(eq(scheduledTasks.date, date));
  const caregiverRows = await db.select().from(caregivers);
  const profileRows = await db.select().from(profiles);
  const templateRows = await db.select().from(taskTemplates);

  const completed = tasks.filter((task) => task.status === "completed").length;
  const issuesCount = tasks.filter(
    (task) => task.status === "completed_with_issue",
  ).length;
  const pending = tasks.filter((task) => task.status === "pending").length;

  const byCaregiver = caregiverRows
    .filter((caregiver) => caregiver.status === "active")
    .map((caregiver) => {
      const profile = profileRows.find((row) => row.userId === caregiver.userId);
      const list = tasks.filter((task) => task.caregiverId === caregiver.id);
      const done = list.filter((task) => task.status === "completed").length;
      return {
        caregiverId: caregiver.id,
        name: profile?.fullName ?? "Caregiver",
        total: list.length,
        completed: done,
        missed: list.filter(
          (task) => task.status === "pending" && task.dueMs < now,
        ).length,
        issues: list.filter((task) => task.status === "completed_with_issue")
          .length,
        rate: list.length ? Math.round((done / list.length) * 100) : 0,
      };
    });

  const notes = tasks
    .filter((task) => task.note)
    .map((task) => {
      const template = templateRows.find((row) => row.id === task.templateId);
      const caregiver = caregiverRows.find((row) => row.id === task.caregiverId);
      const profile = profileRows.find((row) => row.userId === caregiver?.userId);
      return {
        taskId: task.id,
        caregiverName: profile?.fullName ?? "",
        taskName: template?.name ?? "",
        note: task.note,
      };
    });

  return c.json({
    date,
    total: tasks.length,
    completed,
    pending,
    overdue: tasks.filter(
      (task) => task.status === "pending" && task.dueMs < now,
    ).length,
    issuesCount,
    completionRate: tasks.length
      ? Math.round((completed / tasks.length) * 100)
      : 0,
    byCaregiver,
    notes,
  });
});

app.get("/caregiver", async (c) => {
  const caregiverId = c.req.query("caregiverId");
  const fromDate = c.req.query("fromDate");
  const toDate = c.req.query("toDate");
  if (!caregiverId || !fromDate || !toDate) {
    return c.json({ error: "caregiverId, fromDate, and toDate are required" }, 400);
  }

  const db = getDb(c.env);
  const now = Date.now();
  const tasks = await db
    .select()
    .from(scheduledTasks)
    .where(
      and(
        eq(scheduledTasks.caregiverId, caregiverId),
        gte(scheduledTasks.date, fromDate),
        lte(scheduledTasks.date, toDate),
      ),
    );
  const completedTasks = tasks.filter((task) => task.completedAt);
  const lateness = completedTasks.reduce(
    (sum, task) => sum + Math.max(0, (task.completedAt ?? 0) - task.dueMs),
    0,
  );
  const caregiverRows = await db
    .select()
    .from(caregivers)
    .where(eq(caregivers.id, caregiverId))
    .limit(1);
  const profileRows = caregiverRows[0]
    ? await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, caregiverRows[0].userId))
        .limit(1)
    : [];

  return c.json({
    caregiverName: profileRows[0]?.fullName ?? "Caregiver",
    fromDate,
    toDate,
    total: tasks.length,
    completed: tasks.filter((task) => task.status === "completed").length,
    missed: tasks.filter(
      (task) => task.status === "pending" && task.dueMs < now,
    ).length,
    issuesReported: tasks.filter(
      (task) => task.status === "completed_with_issue",
    ).length,
    avgMinutesLate: completedTasks.length
      ? Math.round(lateness / completedTasks.length / 60000)
      : 0,
    completionRate: tasks.length
      ? Math.round(
          (tasks.filter((task) => task.status === "completed").length /
            tasks.length) *
            100,
        )
      : 0,
  });
});

app.get("/shift", async (c) => {
  const fromDate = c.req.query("fromDate");
  const toDate = c.req.query("toDate");
  if (!fromDate || !toDate) {
    return c.json({ error: "fromDate and toDate are required" }, 400);
  }

  const db = getDb(c.env);
  const shiftRows = await db.select().from(shifts);
  const tasks = await db
    .select()
    .from(scheduledTasks)
    .where(
      and(
        gte(scheduledTasks.date, fromDate),
        lte(scheduledTasks.date, toDate),
      ),
    );

  return c.json(
    shiftRows
      .filter((shift) => shift.active)
      .map((shift) => {
        const list = tasks.filter((task) => task.shiftId === shift.id);
        const done = list.filter((task) => task.status === "completed").length;
        return {
          shiftId: shift.id,
          name: shift.name,
          startTime: shift.startTime,
          endTime: shift.endTime,
          total: list.length,
          completed: done,
          pending: list.filter((task) => task.status === "pending").length,
          issues: list.filter((task) => task.status === "completed_with_issue")
            .length,
          rate: list.length ? Math.round((done / list.length) * 100) : 0,
        };
      }),
  );
});

app.get("/trend", async (c) => {
  const fromDate = c.req.query("fromDate");
  const toDate = c.req.query("toDate");
  if (!fromDate || !toDate) {
    return c.json({ error: "fromDate and toDate are required" }, 400);
  }

  const db = getDb(c.env);
  const tasks = await db
    .select()
    .from(scheduledTasks)
    .where(
      and(
        gte(scheduledTasks.date, fromDate),
        lte(scheduledTasks.date, toDate),
      ),
    );
  const dates = Array.from(new Set(tasks.map((task) => task.date))).sort();

  return c.json(
    dates.map((date) => {
      const list = tasks.filter((task) => task.date === date);
      const done = list.filter((task) => task.status === "completed").length;
      return {
        date,
        total: list.length,
        completed: done,
        rate: list.length ? Math.round((done / list.length) * 100) : 0,
      };
    }),
  );
});

export default app;
