import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import {
  caregivers,
  medicationLogs,
  medications,
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

const medicationSchema = z.object({
  patientId: z.string().min(1).optional(),
  name: z.string().trim().min(1),
  dosage: z.string().trim().optional(),
  route: z.string().trim().optional(),
  frequency: z.string().trim().optional(),
  times: z.array(z.string().regex(/^\d{1,2}:\d{2}$/)).default([]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  instructions: z.string().trim().optional(),
  stock: z.number().optional(),
  refillThreshold: z.number().optional(),
  active: z.boolean().optional(),
});

const logSchema = z.object({
  medicationId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduledTime: z.string().regex(/^\d{1,2}:\d{2}$/),
  status: z.enum(["taken", "skipped", "missed"]),
  skipReason: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  caregiverId: z.string().min(1).optional(),
});

function normalizeTimes(times: string[]) {
  return Array.from(
    new Set(
      times.map((time) => {
        const [hours, minutes] = time.split(":");
        return `${String(Number(hours)).padStart(2, "0")}:${minutes}`;
      }),
    ),
  ).sort();
}

function eachDate(fromDate: string, toDate: string) {
  const dates: string[] = [];
  const cursor = new Date(`${fromDate}T00:00:00Z`);
  const end = new Date(`${toDate}T00:00:00Z`);
  while (cursor <= end && dates.length < 370) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

async function patientName(db: Db, patientId?: string | null) {
  if (!patientId) return null;
  const rows = await db
    .select({ fullName: patients.fullName })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  return rows[0]?.fullName ?? null;
}

async function caregiverName(db: Db, caregiverId?: string | null) {
  if (!caregiverId) return null;
  const rows = await db
    .select({ fullName: profiles.fullName })
    .from(caregivers)
    .innerJoin(profiles, eq(profiles.userId, caregivers.userId))
    .where(eq(caregivers.id, caregiverId))
    .limit(1);
  return rows[0]?.fullName ?? null;
}

app.get("/", async (c) => {
  const db = getDb(c.env);
  const rows = await db.select().from(medications);
  return c.json(
    rows.map((row) => ({
      ...row,
      patientName: row.patientName ?? "Unspecified",
      lowStock:
        row.active &&
        row.stock != null &&
        row.refillThreshold != null &&
        row.stock <= row.refillThreshold,
    })),
  );
});

app.post("/", requireAdmin, zValidator("json", medicationSchema), async (c) => {
  const db = getDb(c.env);
  const body = c.req.valid("json");
  const id = crypto.randomUUID();

  await db.insert(medications).values({
    id,
    patientId: body.patientId ?? null,
    patientName: await patientName(db, body.patientId),
    name: body.name,
    dosage: body.dosage ?? null,
    route: body.route ?? null,
    frequency: body.frequency ?? null,
    times: normalizeTimes(body.times),
    startDate: body.startDate ?? null,
    endDate: body.endDate ?? null,
    instructions: body.instructions ?? null,
    stock: body.stock ?? null,
    refillThreshold: body.refillThreshold ?? null,
    active: body.active ?? true,
    createdAt: Date.now(),
  });

  await logAudit(db, {
    userId: c.get("session").user.id,
    action: "medication.created",
    entityType: "medication",
    entityId: id,
    newValue: body.name,
  });

  const rows = await db.select().from(medications).where(eq(medications.id, id));
  return c.json(rows[0], 201);
});

app.patch(
  "/:id",
  requireAdmin,
  zValidator("json", medicationSchema.partial()),
  async (c) => {
    const db = getDb(c.env);
    const body = c.req.valid("json");
    const id = c.req.param("id");
    const existing = await db
      .select()
      .from(medications)
      .where(eq(medications.id, id))
      .limit(1);
    if (existing.length === 0) {
      return c.json({ error: "Medication not found" }, 404);
    }

    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (value === undefined) continue;
      if (key === "times" && Array.isArray(value)) {
        updates.times = normalizeTimes(value as string[]);
      } else if (key === "patientId") {
        updates.patientId = value ?? null;
        updates.patientName = await patientName(db, value as string | null);
      } else {
        updates[key] = value;
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.update(medications).set(updates).where(eq(medications.id, id));
    }

    await logAudit(db, {
      userId: c.get("session").user.id,
      action: "medication.updated",
      entityType: "medication",
      entityId: id,
      newValue: JSON.stringify(body),
    });

    const rows = await db.select().from(medications).where(eq(medications.id, id));
    return c.json(rows[0]);
  },
);

app.get("/doses", async (c) => {
  const db = getDb(c.env);
  const date = c.req.query("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ error: "Invalid date" }, 400);
  }

  const meds = (await db.select().from(medications)).filter(
    (med) =>
      med.active &&
      (!med.startDate || date >= med.startDate) &&
      (!med.endDate || date <= med.endDate),
  );
  const logs = await db
    .select()
    .from(medicationLogs)
    .where(eq(medicationLogs.date, date));

  return c.json(
    meds.map((med) => ({
      ...med,
      patientName: med.patientName ?? "Unspecified",
      lowStock:
        med.stock != null &&
        med.refillThreshold != null &&
        med.stock <= med.refillThreshold,
      doses: med.times.map((time) => ({
        time,
        log:
          logs.find(
            (row) =>
              row.medicationId === med.id && row.scheduledTime === time,
          ) ?? null,
      })),
    })),
  );
});

app.post("/doses/log", zValidator("json", logSchema), async (c) => {
  const db = getDb(c.env);
  const body = c.req.valid("json");
  const profile = c.get("profile");
  if (!profile) return c.json({ error: "Profile not found" }, 403);

  const medRows = await db
    .select()
    .from(medications)
    .where(eq(medications.id, body.medicationId))
    .limit(1);
  const medication = medRows[0];
  if (!medication) return c.json({ error: "Medication not found" }, 404);

  let caregiverId = body.caregiverId ?? null;
  if (profile.role === "caregiver") {
    const rows = await db
      .select({ id: caregivers.id })
      .from(caregivers)
      .where(eq(caregivers.userId, profile.userId))
      .limit(1);
    caregiverId = rows[0]?.id ?? null;
  }

  const existingRows = await db
    .select()
    .from(medicationLogs)
    .where(
      and(
        eq(medicationLogs.medicationId, body.medicationId),
        eq(medicationLogs.date, body.date),
        eq(medicationLogs.scheduledTime, body.scheduledTime),
      ),
    )
    .limit(1);
  const existing = existingRows[0];

  let stockDelta = 0;
  if (existing?.status === "taken" && body.status !== "taken") stockDelta += 1;
  if (existing?.status !== "taken" && body.status === "taken") stockDelta -= 1;

  if (medication.stock != null && stockDelta !== 0) {
    await db
      .update(medications)
      .set({ stock: Math.max(0, medication.stock + stockDelta) })
      .where(eq(medications.id, medication.id));
  }

  const values = {
    patientId: medication.patientId,
    caregiverId,
    caregiverName:
      profile.role === "caregiver"
        ? profile.fullName
        : await caregiverName(db, caregiverId),
    status: body.status,
    takenAt: body.status === "taken" ? Date.now() : null,
    skipReason:
      body.status === "skipped" ? body.skipReason || "Not specified" : null,
    notes: body.notes ?? null,
  };

  if (existing) {
    await db
      .update(medicationLogs)
      .set(values)
      .where(eq(medicationLogs.id, existing.id));
  } else {
    await db.insert(medicationLogs).values({
      id: crypto.randomUUID(),
      medicationId: body.medicationId,
      date: body.date,
      scheduledTime: body.scheduledTime,
      ...values,
      createdAt: Date.now(),
    });
  }

  c.executionCtx.waitUntil(
    broadcastWorkspace(c.env, {
      type: "medication.logged",
      entity: "medication_logs",
      id: body.medicationId,
      at: Date.now(),
    }),
  );

  return c.json({ ok: true });
});

app.post(
  "/doses/clear",
  zValidator(
    "json",
    z.object({
      medicationId: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      scheduledTime: z.string().regex(/^\d{1,2}:\d{2}$/),
    }),
  ),
  async (c) => {
    const db = getDb(c.env);
    const body = c.req.valid("json");
    const rows = await db
      .select()
      .from(medicationLogs)
      .where(
        and(
          eq(medicationLogs.medicationId, body.medicationId),
          eq(medicationLogs.date, body.date),
          eq(medicationLogs.scheduledTime, body.scheduledTime),
        ),
      )
      .limit(1);
    const log = rows[0];
    if (!log) return c.json({ ok: true });

    if (log.status === "taken") {
      const medRows = await db
        .select()
        .from(medications)
        .where(eq(medications.id, body.medicationId))
        .limit(1);
      if (medRows[0]?.stock != null) {
        await db
          .update(medications)
          .set({ stock: medRows[0].stock + 1 })
          .where(eq(medications.id, body.medicationId));
      }
    }

    await db.delete(medicationLogs).where(eq(medicationLogs.id, log.id));
    return c.json({ ok: true });
  },
);

app.get("/adherence", async (c) => {
  const db = getDb(c.env);
  const fromDate = c.req.query("fromDate");
  const toDate = c.req.query("toDate");
  const nowDate = c.req.query("nowDate");
  const nowTime = c.req.query("nowTime");

  if (!fromDate || !toDate || !nowDate || !nowTime) {
    return c.json(
      { error: "fromDate, toDate, nowDate, and nowTime are required" },
      400,
    );
  }

  const dates = eachDate(fromDate, toDate);
  if (dates.length === 0) return c.json({ error: "Invalid date range" }, 400);

  const meds = (await db.select().from(medications)).filter(
    (med) => med.active,
  );
  const logs = await db.select().from(medicationLogs);

  const rows = meds.map((med) => {
    let expected = 0;
    let taken = 0;
    let skipped = 0;
    let missed = 0;

    for (const date of dates) {
      if (med.startDate && date < med.startDate) continue;
      if (med.endDate && date > med.endDate) continue;
      for (const time of med.times) {
        if (date > nowDate) continue;
        if (date === nowDate && time > nowTime) continue;
        expected += 1;
        const log = logs.find(
          (row) =>
            row.medicationId === med.id &&
            row.date === date &&
            row.scheduledTime === time,
        );
        if (log?.status === "taken") taken += 1;
        else if (log?.status === "skipped") skipped += 1;
        else missed += 1;
      }
    }

    return {
      medicationId: med.id,
      name: med.name,
      patientName: med.patientName ?? "Unspecified",
      expected,
      taken,
      skipped,
      missed,
      rate: expected > 0 ? Math.round((taken / expected) * 100) : 0,
      stock: med.stock,
      refillThreshold: med.refillThreshold,
      lowStock:
        med.stock != null &&
        med.refillThreshold != null &&
        med.stock <= med.refillThreshold,
    };
  });

  const totals = rows.reduce(
    (sum, row) => ({
      expected: sum.expected + row.expected,
      taken: sum.taken + row.taken,
      skipped: sum.skipped + row.skipped,
      missed: sum.missed + row.missed,
    }),
    { expected: 0, taken: 0, skipped: 0, missed: 0 },
  );

  return c.json({
    ...totals,
    rate: totals.expected > 0 ? Math.round((totals.taken / totals.expected) * 100) : 0,
    medications: rows,
  });
});

export default app;
