import { Hono } from "hono";
import { and, eq, inArray } from "drizzle-orm";
import {
  caregivers,
  issues,
  scheduledTasks,
  taskTemplates,
} from "@careshift/db";
import { getDb } from "../db";
import { requireAdmin, requireUser } from "../middleware/auth";
import type { Bindings, Variables } from "../env";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", requireUser);

type TimelineEvent = {
  time: number;
  label: string;
  kind: string;
  detail?: string;
};

async function buildTimeline(
  db: ReturnType<typeof getDb>,
  caregiverId: string,
  date: string,
) {
  const tasks = await db
    .select()
    .from(scheduledTasks)
    .where(
      and(
        eq(scheduledTasks.caregiverId, caregiverId),
        eq(scheduledTasks.date, date),
      ),
    );
  const templateIds = Array.from(new Set(tasks.map((task) => task.templateId)));
  const templates =
    templateIds.length > 0
      ? await db
          .select()
          .from(taskTemplates)
          .where(inArray(taskTemplates.id, templateIds))
      : [];
  const issueRows = await db
    .select()
    .from(issues)
    .where(eq(issues.caregiverId, caregiverId));

  const events: TimelineEvent[] = [];
  const shiftStartMs = tasks[0]?.shiftStartMs;
  const shiftEndMs = tasks[0]?.shiftEndMs;

  if (tasks.length > 0) {
    if (shiftStartMs) {
      events.push({ time: shiftStartMs, label: "Shift started", kind: "shift_start" });
    }
    for (const task of tasks) {
      const template = templates.find((row) => row.id === task.templateId);
      const taskIssues = issueRows.filter(
        (row) => row.scheduledTaskId === task.id,
      );
      if (task.completedAt) {
        events.push({
          time: task.completedAt,
          label: `${template?.name ?? "Task"} completed`,
          kind: taskIssues.length > 0 ? "task_done_with_issue" : "task_done",
        });
      }
      for (const issue of taskIssues) {
        events.push({
          time: issue.createdAt,
          label: `Issue reported — ${issue.issueType}`,
          kind: "issue_reported",
          detail: issue.description,
        });
      }
    }
    if (shiftEndMs && shiftEndMs <= Date.now()) {
      events.push({ time: shiftEndMs, label: "Shift ended", kind: "shift_end" });
    }
  }

  return events.sort((a, b) => a.time - b.time);
}

app.get("/", requireAdmin, async (c) => {
  const caregiverId = c.req.query("caregiverId");
  const date = c.req.query("date");
  if (!caregiverId || !date) {
    return c.json({ error: "caregiverId and date are required" }, 400);
  }
  const db = getDb(c.env);
  return c.json(await buildTimeline(db, caregiverId, date));
});

app.get("/me", async (c) => {
  const profile = c.get("profile");
  if (!profile || profile.role !== "caregiver") {
    return c.json({ error: "Caregiver only" }, 403);
  }
  const date = c.req.query("date");
  if (!date) return c.json({ error: "date is required" }, 400);

  const db = getDb(c.env);
  const rows = await db
    .select({ id: caregivers.id })
    .from(caregivers)
    .where(eq(caregivers.userId, profile.userId))
    .limit(1);
  if (!rows[0]) return c.json({ error: "Caregiver record not found" }, 404);

  return c.json(await buildTimeline(db, rows[0].id, date));
});

export default app;
