import { Hono } from "hono";
import { and, desc, eq, gte, lt, lte, type SQL } from "drizzle-orm";
import {
  auditLogs,
  caregivers,
  issues,
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
  const now = Date.now();
  const tasks = await db
    .select()
    .from(scheduledTasks)
    .where(eq(scheduledTasks.date, date));
  const caregiverRows = await db
    .select()
    .from(caregivers)
    .where(eq(caregivers.status, "active"));
  const profileRows = await db.select().from(profiles);
  const shiftRows = await db.select().from(shifts);
  const templateRows = await db.select().from(taskTemplates);
  const issueRows = await db
    .select()
    .from(issues)
    .where(eq(issues.status, "open"));

  const completed = tasks.filter((task) => task.status === "completed").length;
  const withIssue = tasks.filter(
    (task) => task.status === "completed_with_issue",
  ).length;
  const pending = tasks.filter(
    (task) => task.status === "pending" && task.dueMs >= now,
  ).length;
  const overdue = tasks.filter(
    (task) => task.status === "pending" && task.dueMs < now,
  ).length;
  const todayIssues = issueRows.filter((issue) =>
    tasks.some((task) => task.id === issue.scheduledTaskId),
  ).length;

  const caregiverStatus = caregiverRows
    .map((caregiver) => {
      const profile = profileRows.find((row) => row.userId === caregiver.userId);
      const shift = shiftRows.find((row) => row.id === caregiver.shiftId);
      const list = tasks.filter((task) => task.caregiverId === caregiver.id);
      const cgCompleted = list.filter((task) => task.status === "completed").length;
      const cgIssue = list.filter(
        (task) => task.status === "completed_with_issue",
      ).length;
      const cgPending = list.filter(
        (task) => task.status === "pending" && task.dueMs >= now,
      ).length;
      const cgOverdue = list.filter(
        (task) => task.status === "pending" && task.dueMs < now,
      ).length;
      const shiftStartMs = list[0]?.shiftStartMs ?? null;
      const shiftEndMs = list[0]?.shiftEndMs ?? null;

      let liveStatus: "completed" | "working" | "pending" | "overdue" | "upcoming" =
        "upcoming";
      if (shiftStartMs && shiftEndMs) {
        if (now < shiftStartMs) liveStatus = "upcoming";
        else if (now >= shiftEndMs) {
          liveStatus =
            list.length > 0 && cgCompleted + cgIssue === list.length
              ? "completed"
              : "overdue";
        } else liveStatus = cgOverdue > 0 ? "overdue" : "working";
      }

      return {
        caregiverId: caregiver.id,
        name: profile?.fullName ?? "Caregiver",
        shiftName: shift?.name ?? "No shift",
        shiftStart: shift?.startTime,
        shiftEnd: shift?.endTime,
        completed: cgCompleted,
        withIssue: cgIssue,
        pending: cgPending,
        overdue: cgOverdue,
        total: list.length,
        liveStatus,
      };
    })
    .sort((a, b) =>
      (a.shiftStart ?? "99") < (b.shiftStart ?? "99") ? -1 : 1,
    );

  const shiftBreakdown = shiftRows
    .filter((shift) => shift.active)
    .map((shift) => {
      const list = tasks.filter((task) => task.shiftId === shift.id);
      const done = list.filter((task) => task.status === "completed").length;
      return {
        shiftId: shift.id,
        name: shift.name,
        total: list.length,
        completed: done,
        rate: list.length ? Math.round((done / list.length) * 100) : 0,
      };
    });

  return c.json({
    date,
    now,
    totalCaregivers: caregiverRows.length,
    totalTasks: tasks.length,
    completed,
    withIssue,
    pending,
    overdue,
    issues: todayIssues,
    completionRate: tasks.length
      ? Math.round((completed / tasks.length) * 100)
      : 0,
    templatesCount: templateRows.length,
    caregiverStatus,
    shiftBreakdown,
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
  const shiftId = c.req.query("shiftId");
  const templateId = c.req.query("templateId");
  const status = c.req.query("status");
  const now = Date.now();
  if (caregiverId) conditions.push(eq(scheduledTasks.caregiverId, caregiverId));
  if (shiftId) conditions.push(eq(scheduledTasks.shiftId, shiftId));
  if (templateId) conditions.push(eq(scheduledTasks.templateId, templateId));
  if (status === "overdue") {
    conditions.push(eq(scheduledTasks.status, "pending"));
    conditions.push(lt(scheduledTasks.dueMs, now));
  } else if (status === "issue") {
    conditions.push(eq(scheduledTasks.status, "completed_with_issue"));
  } else if (status && status !== "all") {
    conditions.push(eq(scheduledTasks.status, status));
  }

  const db = getDb(c.env);
  const rows = await db
    .select({
      id: scheduledTasks.id,
      date: scheduledTasks.date,
      scheduledTime: scheduledTasks.scheduledTime,
      status: scheduledTasks.status,
      dueMs: scheduledTasks.dueMs,
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

  return c.json(
    rows.map((row) => ({
      ...row,
      overdue: row.status === "pending" && row.dueMs < now,
    })),
  );
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
