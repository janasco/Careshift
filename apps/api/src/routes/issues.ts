import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { caregivers, issues, profiles, scheduledTasks, taskTemplates } from "@careshift/db";
import { getDb } from "../db";
import { logAudit } from "../lib/audit";
import { requireAdmin, requireUser } from "../middleware/auth";
import type { Bindings, Variables } from "../env";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", requireUser);
app.use("*", requireAdmin);

app.get("/", async (c) => {
  const db = getDb(c.env);
  const status = c.req.query("status");
  const rows = await db
    .select({
      id: issues.id,
      scheduledTaskId: issues.scheduledTaskId,
      caregiverId: issues.caregiverId,
      caregiverName: profiles.fullName,
      issueType: issues.issueType,
      description: issues.description,
      status: issues.status,
      createdAt: issues.createdAt,
      resolvedAt: issues.resolvedAt,
      taskName: taskTemplates.name,
      taskDate: scheduledTasks.date,
    })
    .from(issues)
    .leftJoin(caregivers, eq(caregivers.id, issues.caregiverId))
    .leftJoin(profiles, eq(profiles.userId, caregivers.userId))
    .leftJoin(scheduledTasks, eq(scheduledTasks.id, issues.scheduledTaskId))
    .leftJoin(taskTemplates, eq(taskTemplates.id, scheduledTasks.templateId))
    .where(status ? eq(issues.status, status) : undefined)
    .orderBy(desc(issues.createdAt));

  return c.json(rows);
});

app.patch(
  "/:id/resolve",
  zValidator(
    "json",
    z.object({ note: z.string().trim().optional() }).default({}),
  ),
  async (c) => {
    const db = getDb(c.env);
    const id = c.req.param("id");
    const body = c.req.valid("json");
    const existing = await db
      .select()
      .from(issues)
      .where(eq(issues.id, id))
      .limit(1);
    if (existing.length === 0) return c.json({ error: "Issue not found" }, 404);

    const now = Date.now();
    await db
      .update(issues)
      .set({
        status: "resolved",
        resolvedAt: now,
        resolvedByUserId: c.get("session").user.id,
      })
      .where(eq(issues.id, id));

    await logAudit(db, {
      userId: c.get("session").user.id,
      action: "issue.resolved",
      entityType: "issue",
      entityId: id,
      oldValue: existing[0].description,
      newValue: body.note ?? "resolved",
    });

    return c.json({ ok: true });
  },
);

export default app;
