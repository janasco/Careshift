import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, desc, eq, type SQL } from "drizzle-orm";
import {
  careEvents,
  caregivers,
  patients,
  profiles,
} from "@careshift/db";
import { getDb, type Db } from "../db";
import { logAudit } from "../lib/audit";
import { broadcastWorkspace } from "../lib/realtime";
import { requireAdmin, requireUser } from "../middleware/auth";
import type { Bindings, Variables } from "../env";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", requireUser);

const eventSchema = z.object({
  patientId: z.string().min(1).optional(),
  patientName: z.string().trim().optional(),
  caregiverId: z.string().min(1).optional(),
  eventType: z.string().trim().min(1),
  severity: z.enum(["low", "medium", "high"]).optional(),
  occurredAt: z.number().int().optional(),
  timeLabel: z.string().trim().optional(),
  notes: z.string().trim().min(1),
});

async function resolveNames(
  db: Db,
  patientId?: string,
  caregiverId?: string,
  fallbackPatientName?: string,
) {
  let patientName = fallbackPatientName ?? null;
  let caregiverName: string | null = null;

  if (patientId) {
    const rows = await db
      .select({ fullName: patients.fullName })
      .from(patients)
      .where(eq(patients.id, patientId))
      .limit(1);
    patientName = rows[0]?.fullName ?? patientName;
  }

  if (caregiverId) {
    const rows = await db
      .select({ fullName: profiles.fullName })
      .from(caregivers)
      .innerJoin(profiles, eq(profiles.userId, caregivers.userId))
      .where(eq(caregivers.id, caregiverId))
      .limit(1);
    caregiverName = rows[0]?.fullName ?? null;
  }

  return { patientName, caregiverName };
}

app.get("/", async (c) => {
  const db = getDb(c.env);
  const conditions: SQL[] = [];
  const patientId = c.req.query("patientId");
  const caregiverId = c.req.query("caregiverId");
  const eventType = c.req.query("eventType");

  if (patientId) conditions.push(eq(careEvents.patientId, patientId));
  if (caregiverId) conditions.push(eq(careEvents.caregiverId, caregiverId));
  if (eventType) conditions.push(eq(careEvents.eventType, eventType));

  const rows = await db
    .select()
    .from(careEvents)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(careEvents.createdAt));

  return c.json(rows);
});

app.post("/", zValidator("json", eventSchema), async (c) => {
  const db = getDb(c.env);
  const body = c.req.valid("json");
  const profile = c.get("profile");
  if (!profile) return c.json({ error: "Profile not found" }, 403);

  let caregiverId = body.caregiverId ?? null;
  if (profile.role === "caregiver") {
    const rows = await db
      .select({ id: caregivers.id })
      .from(caregivers)
      .where(eq(caregivers.userId, profile.userId))
      .limit(1);
    caregiverId = rows[0]?.id ?? null;
  }

  const names = await resolveNames(
    db,
    body.patientId,
    caregiverId ?? undefined,
    body.patientName,
  );

  const id = crypto.randomUUID();
  await db.insert(careEvents).values({
    id,
    patientId: body.patientId ?? null,
    patientName: names.patientName,
    caregiverId,
    caregiverName:
      profile.role === "caregiver" ? profile.fullName : names.caregiverName,
    eventType: body.eventType,
    severity: body.severity ?? null,
    occurredAt: body.occurredAt ?? null,
    timeLabel: body.timeLabel ?? null,
    notes: body.notes,
    source: "api",
    createdAt: Date.now(),
  });

  await logAudit(db, {
    userId: c.get("session").user.id,
    action: "care_event.created",
    entityType: "care_event",
    entityId: id,
    newValue: body.eventType,
  });
  c.executionCtx.waitUntil(
    broadcastWorkspace(c.env, {
      type: "care_event.created",
      entity: "care_events",
      id,
      at: Date.now(),
    }),
  );

  const rows = await db.select().from(careEvents).where(eq(careEvents.id, id));
  return c.json(rows[0], 201);
});

app.patch(
  "/:id",
  requireAdmin,
  zValidator("json", eventSchema.partial()),
  async (c) => {
    const db = getDb(c.env);
    const body = c.req.valid("json");
    const id = c.req.param("id");
    const existing = await db
      .select()
      .from(careEvents)
      .where(eq(careEvents.id, id))
      .limit(1);
    if (existing.length === 0) return c.json({ error: "Care event not found" }, 404);

    const updates = Object.fromEntries(
      Object.entries(body).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(updates).length > 0) {
      await db.update(careEvents).set(updates).where(eq(careEvents.id, id));
    }

    await logAudit(db, {
      userId: c.get("session").user.id,
      action: "care_event.updated",
      entityType: "care_event",
      entityId: id,
      oldValue: JSON.stringify(existing[0]),
      newValue: JSON.stringify(body),
    });

    const rows = await db.select().from(careEvents).where(eq(careEvents.id, id));
    return c.json(rows[0]);
  },
);

export default app;
