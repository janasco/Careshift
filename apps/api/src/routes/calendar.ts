import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, asc, eq, gte, lte, type SQL } from "drizzle-orm";
import { calendarEvents, patients } from "@careshift/db";
import { getDb } from "../db";
import { logAudit } from "../lib/audit";
import { broadcastWorkspace } from "../lib/realtime";
import { requireAdmin, requireUser } from "../middleware/auth";
import type { Bindings, Variables } from "../env";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", requireUser);

const eventSchema = z.object({
  title: z.string().trim().min(1),
  eventType: z
    .enum(["appointment", "visit", "medication", "reminder", "other"])
    .optional(),
  patientId: z.string().min(1).nullable().optional(),
  location: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  startMs: z.number().int(),
  endMs: z.number().int().nullable().optional(),
  allDay: z.boolean().optional(),
});

async function patientNameFor(db: ReturnType<typeof getDb>, patientId?: string | null) {
  if (!patientId) return null;
  const rows = await db
    .select({ fullName: patients.fullName })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  return rows[0]?.fullName ?? null;
}

app.get("/", async (c) => {
  const fromMs = Number(c.req.query("fromMs"));
  const toMs = Number(c.req.query("toMs"));
  const limit = Math.min(Number(c.req.query("limit") ?? 200), 500);

  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    return c.json({ error: "fromMs and toMs are required" }, 400);
  }

  const conditions: SQL[] = [
    gte(calendarEvents.startMs, fromMs),
    lte(calendarEvents.startMs, toMs),
  ];

  const db = getDb(c.env);
  const rows = await db
    .select()
    .from(calendarEvents)
    .where(and(...conditions))
    .orderBy(asc(calendarEvents.startMs))
    .limit(limit);

  return c.json(
    rows.map((row) => ({
      ...row,
      patientName: row.patientName ?? "All care",
    })),
  );
});

app.post("/", requireAdmin, zValidator("json", eventSchema), async (c) => {
  const db = getDb(c.env);
  const body = c.req.valid("json");
  const profile = c.get("profile");

  if (body.endMs != null && body.endMs < body.startMs) {
    return c.json({ error: "End time must be after start time" }, 400);
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  const eventType = body.eventType ?? "appointment";

  await db.insert(calendarEvents).values({
    id,
    patientId: body.patientId ?? null,
    patientName: await patientNameFor(db, body.patientId),
    title: body.title,
    eventType,
    location: body.location ?? null,
    notes: body.notes ?? null,
    startMs: body.startMs,
    endMs: body.endMs ?? null,
    allDay: body.allDay ?? false,
    createdByUserId: c.get("session").user.id,
    createdByName: profile?.fullName ?? null,
    createdAt: now,
    updatedAt: now,
  });

  await logAudit(db, {
    userId: c.get("session").user.id,
    action: "calendar_event.created",
    entityType: "calendar_event",
    entityId: id,
    newValue: body.title,
  });
  c.executionCtx.waitUntil(
    broadcastWorkspace(c.env, {
      type: "calendar_event.created",
      entity: "calendar_events",
      id,
      at: now,
    }),
  );

  const rows = await db
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.id, id))
    .limit(1);
  return c.json(rows[0], 201);
});

app.patch(
  "/:id",
  requireAdmin,
  zValidator("json", eventSchema.partial()),
  async (c) => {
    const db = getDb(c.env);
    const id = c.req.param("id");
    const body = c.req.valid("json");
    const existingRows = await db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.id, id))
      .limit(1);
    const existing = existingRows[0];
    if (!existing) return c.json({ error: "Calendar event not found" }, 404);

    const startMs = body.startMs ?? existing.startMs;
    const endMs = body.endMs === undefined ? existing.endMs : body.endMs;
    if (endMs != null && endMs < startMs) {
      return c.json({ error: "End time must be after start time" }, 400);
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (body.title !== undefined) updates.title = body.title;
    if (body.eventType !== undefined) updates.eventType = body.eventType;
    if (body.location !== undefined) updates.location = body.location || null;
    if (body.notes !== undefined) updates.notes = body.notes || null;
    if (body.startMs !== undefined) updates.startMs = body.startMs;
    if (body.endMs !== undefined) updates.endMs = body.endMs;
    if (body.allDay !== undefined) updates.allDay = body.allDay;
    if (body.patientId !== undefined) {
      updates.patientId = body.patientId;
      updates.patientName = await patientNameFor(db, body.patientId);
    }

    await db.update(calendarEvents).set(updates).where(eq(calendarEvents.id, id));

    await logAudit(db, {
      userId: c.get("session").user.id,
      action: "calendar_event.updated",
      entityType: "calendar_event",
      entityId: id,
      oldValue: existing.title,
      newValue: body.title ?? existing.title,
    });
    c.executionCtx.waitUntil(
      broadcastWorkspace(c.env, {
        type: "calendar_event.updated",
        entity: "calendar_events",
        id,
        at: Date.now(),
      }),
    );

    const rows = await db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.id, id))
      .limit(1);
    return c.json(rows[0]);
  },
);

app.delete("/:id", requireAdmin, async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");
  const existing = await db
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.id, id))
    .limit(1);
  if (!existing[0]) return c.json({ error: "Calendar event not found" }, 404);

  await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
  await logAudit(db, {
    userId: c.get("session").user.id,
    action: "calendar_event.deleted",
    entityType: "calendar_event",
    entityId: id,
    oldValue: existing[0].title,
  });
  c.executionCtx.waitUntil(
    broadcastWorkspace(c.env, {
      type: "calendar_event.deleted",
      entity: "calendar_events",
      id,
      at: Date.now(),
    }),
  );

  return c.json({ ok: true });
});

export default app;
