import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import {
  caregivers,
  profiles,
  scheduledTasks,
  shifts,
  visits,
} from "@careshift/db";
import { getDb } from "../db";
import { logAudit } from "../lib/audit";
import { getCaregiverForUser } from "../lib/caregivers";
import { broadcastWorkspace } from "../lib/realtime";
import { requireAdmin, requireUser } from "../middleware/auth";
import type { Bindings, Variables } from "../env";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", requireUser);

const locationSchema = z.object({
  lat: z.number().optional(),
  lng: z.number().optional(),
  accuracy: z.number().optional(),
  notes: z.string().trim().optional(),
});

const clockInSchema = locationSchema.extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const clockOutSchema = locationSchema.extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  visitId: z.string().min(1).optional(),
});

app.get("/today", async (c) => {
  const profile = c.get("profile");
  if (!profile || profile.role !== "caregiver") {
    return c.json({ error: "Caregiver only" }, 403);
  }
  const date = c.req.query("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ error: "Invalid date" }, 400);
  }

  const db = getDb(c.env);
  const caregiver = await getCaregiverForUser(db, profile.userId);
  if (!caregiver) return c.json({ error: "Caregiver record not found" }, 404);

  const allVisits = await db
    .select()
    .from(visits)
    .where(eq(visits.caregiverId, caregiver.id))
    .orderBy(desc(visits.clockInAt));

  const active = allVisits.find((visit) => visit.status === "active");
  if (active) return c.json(active);
  return c.json(allVisits.find((visit) => visit.date === date) ?? null);
});

app.post("/clock-in", zValidator("json", clockInSchema), async (c) => {
  const profile = c.get("profile");
  if (!profile || profile.role !== "caregiver") {
    return c.json({ error: "Caregiver only" }, 403);
  }

  const db = getDb(c.env);
  const caregiver = await getCaregiverForUser(db, profile.userId);
  if (!caregiver) return c.json({ error: "Caregiver record not found" }, 404);

  const active = await db
    .select({ id: visits.id })
    .from(visits)
    .where(and(eq(visits.caregiverId, caregiver.id), eq(visits.status, "active")))
    .limit(1);
  if (active.length > 0) {
    return c.json(
      { error: "You are already clocked in. Clock out before starting a new visit." },
      409,
    );
  }

  const body = c.req.valid("json");
  const id = crypto.randomUUID();
  await db.insert(visits).values({
    id,
    caregiverId: caregiver.id,
    caregiverName: profile.fullName,
    shiftId: caregiver.shiftId,
    date: body.date,
    clockInAt: Date.now(),
    clockInLat: body.lat ?? null,
    clockInLng: body.lng ?? null,
    clockInAccuracy: body.accuracy ?? null,
    clockInNotes: body.notes ?? null,
    status: "active",
    createdAt: Date.now(),
  });

  await logAudit(db, {
    userId: profile.userId,
    action: "visit.clocked_in",
    entityType: "visit",
    entityId: id,
    newValue: body.date,
  });
  c.executionCtx.waitUntil(
    broadcastWorkspace(c.env, {
      type: "visit.clocked_in",
      entity: "visits",
      id,
      at: Date.now(),
    }),
  );

  const rows = await db.select().from(visits).where(eq(visits.id, id));
  return c.json(rows[0], 201);
});

app.post("/clock-out", zValidator("json", clockOutSchema), async (c) => {
  const profile = c.get("profile");
  if (!profile || profile.role !== "caregiver") {
    return c.json({ error: "Caregiver only" }, 403);
  }

  const db = getDb(c.env);
  const caregiver = await getCaregiverForUser(db, profile.userId);
  if (!caregiver) return c.json({ error: "Caregiver record not found" }, 404);

  const body = c.req.valid("json");
  let visit = null;
  if (body.visitId) {
    const rows = await db
      .select()
      .from(visits)
      .where(eq(visits.id, body.visitId))
      .limit(1);
    visit = rows[0] ?? null;
    if (!visit || visit.caregiverId !== caregiver.id) {
      return c.json({ error: "Visit not found" }, 404);
    }
  } else {
    const rows = await db
      .select()
      .from(visits)
      .where(and(eq(visits.caregiverId, caregiver.id), eq(visits.status, "active")))
      .limit(1);
    visit = rows[0] ?? null;
  }

  if (!visit) return c.json({ error: "No active visit to clock out from" }, 409);
  if (visit.status === "completed") {
    return c.json({ error: "This visit is already completed" }, 409);
  }

  const pending = await db
    .select({ id: scheduledTasks.id })
    .from(scheduledTasks)
    .where(
      and(
        eq(scheduledTasks.caregiverId, caregiver.id),
        eq(scheduledTasks.date, visit.date),
        eq(scheduledTasks.status, "pending"),
      ),
    );

  if (pending.length > 0) {
    return c.json(
      {
        error: `Cannot clock out: ${pending.length} task(s) still pending. Complete them or report an issue first.`,
      },
      409,
    );
  }

  const clockOutAt = Date.now();
  await db
    .update(visits)
    .set({
      clockOutAt,
      clockOutLat: body.lat ?? null,
      clockOutLng: body.lng ?? null,
      clockOutAccuracy: body.accuracy ?? null,
      clockOutNotes: body.notes ?? null,
      status: "completed",
    })
    .where(eq(visits.id, visit.id));

  await logAudit(db, {
    userId: profile.userId,
    action: "visit.clocked_out",
    entityType: "visit",
    entityId: visit.id,
    newValue: String(clockOutAt),
  });
  c.executionCtx.waitUntil(
    broadcastWorkspace(c.env, {
      type: "visit.clocked_out",
      entity: "visits",
      id: visit.id,
      at: Date.now(),
    }),
  );

  return c.json({ ok: true, durationMs: clockOutAt - visit.clockInAt });
});

app.get("/", requireAdmin, async (c) => {
  const date = c.req.query("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ error: "Invalid date" }, 400);
  }

  const db = getDb(c.env);
  const rows = await db
    .select({
      id: visits.id,
      caregiverId: visits.caregiverId,
      caregiverName: profiles.fullName,
      shiftName: shifts.name,
      date: visits.date,
      clockInAt: visits.clockInAt,
      clockInLat: visits.clockInLat,
      clockInLng: visits.clockInLng,
      clockInNotes: visits.clockInNotes,
      clockOutAt: visits.clockOutAt,
      clockOutLat: visits.clockOutLat,
      clockOutLng: visits.clockOutLng,
      clockOutNotes: visits.clockOutNotes,
      status: visits.status,
    })
    .from(visits)
    .leftJoin(caregivers, eq(caregivers.id, visits.caregiverId))
    .leftJoin(profiles, eq(profiles.userId, caregivers.userId))
    .leftJoin(shifts, eq(shifts.id, visits.shiftId))
    .where(eq(visits.date, date))
    .orderBy(desc(visits.clockInAt));

  return c.json(
    rows.map((row) => ({
      ...row,
      durationMs: (row.clockOutAt ?? Date.now()) - row.clockInAt,
      hasClockInGps: row.clockInLat != null && row.clockInLng != null,
      hasClockOutGps: row.clockOutLat != null && row.clockOutLng != null,
    })),
  );
});

export default app;
