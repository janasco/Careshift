import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { account, caregivers, profiles } from "@careshift/db";
import { getDb } from "../db";
import { logAudit } from "../lib/audit";
import { requireAdmin, requireUser } from "../middleware/auth";
import type { Bindings, Variables } from "../env";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", requireUser);

app.post("/touch", async (c) => {
  const profile = c.get("profile");
  if (!profile) return c.json({ ok: true });
  const db = getDb(c.env);
  await db
    .update(profiles)
    .set({ lastLoginAt: Date.now(), updatedAt: Date.now() })
    .where(eq(profiles.id, profile.id));
  return c.json({ ok: true });
});

const updateSchema = z.object({
  fullName: z.string().trim().min(1).optional(),
  phone: z.string().trim().optional(),
  employeeCode: z.string().trim().optional(),
  shiftId: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

app.patch(
  "/:profileId",
  requireAdmin,
  zValidator("json", updateSchema),
  async (c) => {
    const db = getDb(c.env);
    const body = c.req.valid("json");
    const profileId = c.req.param("profileId");
    const rows = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, profileId))
      .limit(1);
    const profile = rows[0];
    if (!profile) return c.json({ error: "Profile not found" }, 404);

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
        updatedAt: Date.now(),
      })
      .where(eq(profiles.id, profileId));

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
      .where(eq(caregivers.userId, profile.userId));

    await logAudit(db, {
      userId: c.get("session").user.id,
      action: "profile.updated",
      entityType: "profile",
      entityId: profileId,
      newValue: JSON.stringify(body),
    });

    const updated = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, profileId))
      .limit(1);
    return c.json(updated[0]);
  },
);

app.post(
  "/:profileId/reset-password",
  requireAdmin,
  zValidator(
    "json",
    z.object({ newPassword: z.string().min(8, "Password must be at least 8 characters") }),
  ),
  async (c) => {
    const db = getDb(c.env);
    const body = c.req.valid("json");
    const profileId = c.req.param("profileId");
    const rows = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, profileId))
      .limit(1);
    const profile = rows[0];
    if (!profile) return c.json({ error: "Profile not found" }, 404);

    const accounts = await db
      .select()
      .from(account)
      .where(
        and(
          eq(account.userId, profile.userId),
          eq(account.providerId, "credential"),
        ),
      )
      .limit(1);
    if (accounts.length === 0) {
      return c.json({ error: "No password account found" }, 404);
    }

    const hashed = await hashPassword(body.newPassword);
    await db
      .update(account)
      .set({ password: hashed, updatedAt: new Date() })
      .where(eq(account.id, accounts[0].id));

    await logAudit(db, {
      userId: c.get("session").user.id,
      action: "profile.password_reset",
      entityType: "profile",
      entityId: profileId,
      newValue: "(redacted)",
    });

    return c.json({ ok: true });
  },
);

export default app;
