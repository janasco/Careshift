import { Hono } from "hono";
import { and, count, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import {
  auditLogs,
  caregivers,
  issues,
  patients,
  profiles,
  scheduledTasks,
  shifts,
  taskTemplates,
  visits,
} from "@careshift/db";
import { getDb } from "../db";
import { requireAdmin, requireUser } from "../middleware/auth";
import type { Bindings, Variables } from "../env";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", requireUser);
app.use("*", requireAdmin);

app.get("/summary", async (c) => {
  const date = c.req.query("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ error: "Invalid date" }, 400);
  }

  const db = getDb(c.env);
  const [totalTasks, completed, completedWithIssue, pending, openIssues, activeCaregivers, activeVisits, patientCount] =
    await Promise.all([
      db
        .select({ value: count() })
        .from(scheduledTasks)
        .where(eq(scheduledTasks.date, date)),
      db
        .select({ value: count() })
        .from(scheduledTasks)
        .where(
          and(
            eq(scheduledTasks.date, date),
            eq(scheduledTasks.status, "completed"),
          ),
        ),
      db
        .select({ value: count() })
        .from(scheduledTasks)
        .where(
          and(
            eq(scheduledTasks.date, date),
            eq(scheduledTasks.status, "completed_with_issue"),
          ),
        ),
      db
        .select({ value: count() })
        .from(scheduledTasks)
        .where(
          and(
            eq(scheduledTasks.date, date),
            eq(scheduledTasks.status, "pending"),
          ),
        ),
      db
        .select({ value: count() })
        .from(issues)
        .where(eq(issues.status, "open")),
      db
        .select({ value: count() })
        .from(caregivers)
        .where(eq(caregivers.status, "active")),
      db
        .select({ value: count() })
        .from(visits)
        .where(eq(visits.status, "active")),
      db.select({ value: count() }).from(patients),
    ]);

  return c.json({
    totalTasks: totalTasks[0]?.value ?? 0,
    completed: completed[0]?.value ?? 0,
    completedWithIssue: completedWithIssue[0]?.value ?? 0,
    pending: pending[0]?.value ?? 0,
    openIssues: openIssues[0]?.value ?? 0,
    activeCaregivers: activeCaregivers[0]?.value ?? 0,
    activeVisits: activeVisits[0]?.value ?? 0,
    patients: patientCount[0]?.value ?? 0,
  });
});

app.get("/history", async (c) => {
  const fromDate = c.req.query("fromDate");
  const toDate = c.req.query("toDate");
  if (!fromDate || !toDate) {
    return c.json({ error: "fromDate and toDate are required" }, 400);
  }

  const conditions: SQL[] = [
    gte(scheduledTasks.date, fromDate),
    lte(scheduledTasks.date, toDate),
  ];
  const caregiverId = c.req.query("caregiverId");
  const status = c.req.query("status");
  if (caregiverId) conditions.push(eq(scheduledTasks.caregiverId, caregiverId));
  if (status) conditions.push(eq(scheduledTasks.status, status));

  const db = getDb(c.env);
  const rows = await db
    .select({
      id: scheduledTasks.id,
      date: scheduledTasks.date,
      scheduledTime: scheduledTasks.scheduledTime,
      status: scheduledTasks.status,
      completedAt: scheduledTasks.completedAt,
      note: scheduledTasks.note,
      taskName: taskTemplates.name,
      category: taskTemplates.category,
      priority: taskTemplates.priority,
      caregiverId: scheduledTasks.caregiverId,
      caregiverName: profiles.fullName,
      shiftName: shifts.name,
    })
    .from(scheduledTasks)
    .leftJoin(taskTemplates, eq(taskTemplates.id, scheduledTasks.templateId))
    .leftJoin(caregivers, eq(caregivers.id, scheduledTasks.caregiverId))
    .leftJoin(profiles, eq(profiles.userId, caregivers.userId))
    .leftJoin(shifts, eq(shifts.id, scheduledTasks.shiftId))
    .where(and(...conditions))
    .orderBy(desc(scheduledTasks.date), desc(scheduledTasks.scheduledTime));

  return c.json(rows);
});

app.get("/audit", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 100), 500);
  const db = getDb(c.env);
  const rows = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
  return c.json(rows);
});

app.get("/visits/overview", async (c) => {
  const date = c.req.query("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ error: "Invalid date" }, 400);
  }

  const db = getDb(c.env);
  const caregiversWithVisits = await db
    .select({ caregiverId: visits.caregiverId })
    .from(visits)
    .where(eq(visits.date, date));
  const activeCaregivers = await db
    .select({
      id: caregivers.id,
      name: profiles.fullName,
      shiftName: shifts.name,
    })
    .from(caregivers)
    .leftJoin(profiles, eq(profiles.userId, caregivers.userId))
    .leftJoin(shifts, eq(shifts.id, caregivers.shiftId))
    .where(eq(caregivers.status, "active"));

  const visited = new Set(caregiversWithVisits.map((row) => row.caregiverId));
  return c.json({
    notStarted: activeCaregivers.filter((row) => !visited.has(row.id)),
  });
});

export default app;
