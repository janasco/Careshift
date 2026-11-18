import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  caregivers,
  profiles,
  shifts,
  user,
} from "@careshift/db";
import { createAuth } from "../auth";
import { getDb } from "../db";
import { logAudit } from "../lib/audit";
import { requireAdmin, requireUser } from "../middleware/auth";
import type { Bindings, Variables } from "../env";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", requireUser);
app.use("*", requireAdmin);

const createSchema = z.object({
  fullName: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(8),
  phone: z.string().trim().optional(),
  employeeCode: z.string().trim().optional(),
  shiftId: z.string().min(1).optional(),
});

const updateSchema = z.object({
  fullName: z.string().trim().min(1).optional(),
  phone: z.string().trim().optional(),
  employeeCode: z.string().trim().optional(),
  shiftId: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

app.get("/", async (c) => {
  const db = getDb(c.env);
  const rows = await db
    .select({
      id: caregivers.id,
      profileId: profiles.id,
      userId: caregivers.userId,
      fullName: profiles.fullName,
      email: user.email,
      phone: caregivers.phone,
      employeeCode: caregivers.employeeCode,
      shiftId: caregivers.shiftId,
      shiftName: shifts.name,
      status: caregivers.status,
      hiredAt: caregivers.hiredAt,
      lastLoginAt: profiles.lastLoginAt,
      active: profiles.active,
    })
    .from(caregivers)
    .leftJoin(profiles, eq(profiles.userId, caregivers.userId))
    .leftJoin(user, eq(user.id, caregivers.userId))
    .leftJoin(shifts, eq(shifts.id, caregivers.shiftId));

  return c.json(rows);
});

app.post("/", zValidator("json", createSchema), async (c) => {
  const db = getDb(c.env);
  const body = c.req.valid("json");
  const email = body.email.toLowerCase();
  const auth = createAuth(c.env);

  try {
    const created = await auth.api.signUpEmail({
      body: {
        name: body.fullName,
        email,
        password: body.password,
      },
    });

    const userId = created.user.id;
    const now = Date.now();
    const existing = await db.select({ id: caregivers.id }).from(caregivers);
    const employeeCode =
      body.employeeCode || `CG-${String(existing.length + 1).padStart(3, "0")}`;

    await db.update(user).set({ role: "caregiver" }).where(eq(user.id, userId));

    const profileId = crypto.randomUUID();
    await db.insert(profiles).values({
      id: profileId,
      userId,
      role: "caregiver",
      fullName: body.fullName,
      phone: body.phone ?? null,
      employeeCode,
      shiftId: body.shiftId ?? null,
      active: true,
      createdAt: now,
      updatedAt: now,
    });

    const caregiverId = crypto.randomUUID();
    await db.insert(caregivers).values({
      id: caregiverId,
      userId,
      shiftId: body.shiftId ?? null,
      phone: body.phone ?? null,
      employeeCode,
      status: "active",
      hiredAt: now,
      createdAt: now,
    });

    await logAudit(db, {
      userId: c.get("session").user.id,
      action: "caregiver.account_created",
      entityType: "caregiver",
      entityId: caregiverId,
      newValue: body.fullName,
    });

    return c.json({ profileId, caregiverId, userId, employeeCode }, 201);
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error ? error.message : "Could not create caregiver",
      },
      400,
    );
  }
});

app.patch("/:id", zValidator("json", updateSchema), async (c) => {
  const db = getDb(c.env);
  const body = c.req.valid("json");
  const caregiverId = c.req.param("id");

  const rows = await db
    .select()
    .from(caregivers)
    .where(eq(caregivers.id, caregiverId))
    .limit(1);
  const caregiver = rows[0];
  if (!caregiver) return c.json({ error: "Caregiver not found" }, 404);

  const now = Date.now();
  await db
    .update(caregivers)
    .set({
      ...(body.phone !== undefined ? { phone: body.phone || null } : {}),
      ...(body.employeeCode !== undefined
        ? { employeeCode: body.employeeCode || null }
        : {}),
      ...(body.shiftId !== undefined ? { shiftId: body.shiftId } : {}),
      ...(body.active !== undefined
        ? { status: body.active ? "active" : "inactive" }
        : {}),
    })
    .where(eq(caregivers.id, caregiverId));

  await db
    .update(profiles)
    .set({
      ...(body.fullName !== undefined ? { fullName: body.fullName } : {}),
      ...(body.phone !== undefined ? { phone: body.phone || null } : {}),
      ...(body.employeeCode !== undefined
        ? { employeeCode: body.employeeCode || null }
        : {}),
      ...(body.shiftId !== undefined ? { shiftId: body.shiftId } : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
      updatedAt: now,
    })
    .where(eq(profiles.userId, caregiver.userId));

  await logAudit(db, {
    userId: c.get("session").user.id,
    action: "caregiver.updated",
    entityType: "caregiver",
    entityId: caregiverId,
    newValue: JSON.stringify(body),
  });

  return c.json({ ok: true });
});

export default app;
