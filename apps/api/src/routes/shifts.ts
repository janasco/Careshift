import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { asc, count, eq } from "drizzle-orm";
import {
  assignments,
  caregivers,
  profiles,
  scheduledTasks,
  shifts,
  visits,
} from "@careshift/db";
import { getDb } from "../db";
import { logAudit } from "../lib/audit";
import { requireAdmin, requireUser } from "../middleware/auth";
import type { Bindings, Variables } from "../env";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", requireUser);

app.get("/", async (c) => {
  const db = getDb(c.env);
  const rows = await db.select().from(shifts).orderBy(asc(shifts.startTime));
  return c.json(rows);
});

const shiftSchema = z.object({
  name: z.string().trim().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  active: z.boolean().optional(),
});

app.post(
  "/",
  requireAdmin,
  zValidator("json", shiftSchema),
  async (c) => {
    const db = getDb(c.env);
    const body = c.req.valid("json");
    const id = crypto.randomUUID();

    await db.insert(shifts).values({
      id,
      name: body.name,
      startTime: body.startTime,
      endTime: body.endTime,
      active: body.active ?? true,
      createdAt: Date.now(),
    });

    await logAudit(db, {
      userId: c.get("session").user.id,
      action: "shift.created",
      entityType: "shift",
      entityId: id,
      newValue: body.name,
    });

    const rows = await db.select().from(shifts).where(eq(shifts.id, id));
    return c.json(rows[0], 201);
  },
);

app.patch(
  "/:id",
  requireAdmin,
  zValidator("json", shiftSchema.partial()),
  async (c) => {
    const db = getDb(c.env);
    const body = c.req.valid("json");
    const id = c.req.param("id");
    const existing = await db.select().from(shifts).where(eq(shifts.id, id));
    if (existing.length === 0) return c.json({ error: "Shift not found" }, 404);

    const updates = Object.fromEntries(
      Object.entries(body).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(updates).length > 0) {
      await db.update(shifts).set(updates).where(eq(shifts.id, id));
    }

    await logAudit(db, {
      userId: c.get("session").user.id,
      action: "shift.updated",
      entityType: "shift",
      entityId: id,
      oldValue: JSON.stringify(existing[0]),
      newValue: JSON.stringify(body),
    });

    const rows = await db.select().from(shifts).where(eq(shifts.id, id));
    return c.json(rows[0]);
  },
);

app.delete("/:id", requireAdmin, async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");
  const existing = await db.select().from(shifts).where(eq(shifts.id, id));
  if (existing.length === 0) return c.json({ error: "Shift not found" }, 404);

  const [profileRefs, caregiverRefs, assignmentRefs, taskRefs, visitRefs] =
    await Promise.all([
      db.select({ value: count() }).from(profiles).where(eq(profiles.shiftId, id)),
      db.select({ value: count() }).from(caregivers).where(eq(caregivers.shiftId, id)),
      db.select({ value: count() }).from(assignments).where(eq(assignments.shiftId, id)),
      db.select({ value: count() }).from(scheduledTasks).where(eq(scheduledTasks.shiftId, id)),
      db.select({ value: count() }).from(visits).where(eq(visits.shiftId, id)),
    ]);

  const references = [
    profileRefs[0]?.value ? `${profileRefs[0].value} profile(s)` : null,
    caregiverRefs[0]?.value ? `${caregiverRefs[0].value} caregiver(s)` : null,
    assignmentRefs[0]?.value ? `${assignmentRefs[0].value} assignment(s)` : null,
    taskRefs[0]?.value ? `${taskRefs[0].value} scheduled task(s)` : null,
    visitRefs[0]?.value ? `${visitRefs[0].value} visit(s)` : null,
  ].filter(Boolean);

  if (references.length > 0) {
    return c.json(
      {
        error: `Cannot delete "${existing[0].name}": it is referenced by ${references.join(", ")}. Deactivate it instead.`,
      },
      409,
    );
  }

  await db.delete(shifts).where(eq(shifts.id, id));
  await logAudit(db, {
    userId: c.get("session").user.id,
    action: "shift.deleted",
    entityType: "shift",
    entityId: id,
    oldValue: JSON.stringify(existing[0]),
  });

  return c.json({ ok: true });
});

export default app;
