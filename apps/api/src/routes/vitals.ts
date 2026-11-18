import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { caregivers, patients, profiles, vitalSigns } from "@careshift/db";
import { getDb } from "../db";
import { requireAdmin, requireUser } from "../middleware/auth";
import type { Bindings, Variables } from "../env";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", requireUser);

const vitalSchema = z.object({
  patientId: z.string().min(1).optional(),
  patientName: z.string().trim().optional(),
  caregiverId: z.string().min(1).optional(),
  timeLabel: z.string().trim().optional(),
  bp: z.string().trim().optional(),
  spo2: z.number().int().min(0).max(100).optional(),
  pulse: z.number().int().min(0).max(400).optional(),
  respiration: z.number().int().min(0).max(100).optional(),
  temperature: z.string().trim().optional(),
  notes: z.string().trim().min(1),
  recordedAt: z.number().int().optional(),
});

app.get("/", async (c) => {
  const db = getDb(c.env);
  const patientId = c.req.query("patientId");
  const rows = patientId
    ? await db
        .select()
        .from(vitalSigns)
        .where(eq(vitalSigns.patientId, patientId))
        .orderBy(desc(vitalSigns.createdAt))
    : await db.select().from(vitalSigns).orderBy(desc(vitalSigns.createdAt));

  return c.json(rows);
});

app.post("/", zValidator("json", vitalSchema), async (c) => {
  const db = getDb(c.env);
  const body = c.req.valid("json");
  const profile = c.get("profile");

  if (!profile) return c.json({ error: "Profile not found" }, 403);

  let patientName = body.patientName ?? null;
  if (body.patientId) {
    const patient = await db
      .select({ fullName: patients.fullName })
      .from(patients)
      .where(eq(patients.id, body.patientId))
      .limit(1);
    patientName = patient[0]?.fullName ?? patientName;
  }

  let caregiverId = body.caregiverId ?? null;
  let caregiverName: string | null = null;

  if (profile.role === "caregiver") {
    const caregiver = await db
      .select({ id: caregivers.id })
      .from(caregivers)
      .where(eq(caregivers.userId, profile.userId))
      .limit(1);
    caregiverId = caregiver[0]?.id ?? null;
    caregiverName = profile.fullName;
  } else if (caregiverId) {
    const rows = await db
      .select({
        fullName: profiles.fullName,
      })
      .from(caregivers)
      .innerJoin(profiles, eq(profiles.userId, caregivers.userId))
      .where(eq(caregivers.id, caregiverId))
      .limit(1);
    caregiverName = rows[0]?.fullName ?? null;
  }

  const id = crypto.randomUUID();
  await db.insert(vitalSigns).values({
    id,
    patientId: body.patientId ?? null,
    patientName,
    caregiverId,
    caregiverName,
    timeLabel: body.timeLabel ?? null,
    bp: body.bp ?? null,
    spo2: body.spo2 ?? null,
    pulse: body.pulse ?? null,
    respiration: body.respiration ?? null,
    temperature: body.temperature ?? null,
    notes: body.notes,
    source: "api",
    recordedAt: body.recordedAt ?? null,
    createdAt: Date.now(),
  });

  const rows = await db
    .select()
    .from(vitalSigns)
    .where(eq(vitalSigns.id, id))
    .limit(1);
  return c.json(rows[0], 201);
});

app.patch(
  "/:id",
  requireAdmin,
  zValidator("json", vitalSchema.partial()),
  async (c) => {
    const db = getDb(c.env);
    const body = c.req.valid("json");
    const updates = Object.fromEntries(
      Object.entries(body).filter(([, value]) => value !== undefined),
    );

    if (Object.keys(updates).length > 0) {
      await db
        .update(vitalSigns)
        .set(updates)
        .where(eq(vitalSigns.id, c.req.param("id")));
    }

    const rows = await db
      .select()
      .from(vitalSigns)
      .where(eq(vitalSigns.id, c.req.param("id")))
      .limit(1);

    if (rows.length === 0) return c.json({ error: "Reading not found" }, 404);
    return c.json(rows[0]);
  },
);

export default app;
