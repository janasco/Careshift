import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { profiles, shifts, user } from "@careshift/db";
import { SHIFT_PRESETS } from "@careshift/shared";
import { createAuth } from "../auth";
import { getDb } from "../db";
import type { Bindings } from "../env";

const app = new Hono<{ Bindings: Bindings }>();

const setupSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

app.get("/status", async (c) => {
  const db = getDb(c.env);
  const admins = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.role, "admin"))
    .limit(1);

  return c.json({ needsSetup: admins.length === 0 });
});

app.post("/admin", zValidator("json", setupSchema), async (c) => {
  const db = getDb(c.env);
  const admins = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.role, "admin"))
    .limit(1);

  if (admins.length > 0) {
    return c.json({ error: "An administrator already exists" }, 409);
  }

  const body = c.req.valid("json");
  const email = body.email.toLowerCase();
  const auth = createAuth(c.env);

  try {
    const created = await auth.api.signUpEmail({
      body: {
        name: body.name,
        email,
        password: body.password,
      },
    });

    const userId = created.user.id;
    const now = Date.now();

    await db.update(user).set({ role: "admin" }).where(eq(user.id, userId));

    const profileId = crypto.randomUUID();
    await db.insert(profiles).values({
      id: profileId,
      userId,
      role: "admin",
      fullName: body.name,
      active: true,
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const existingShifts = await db.select({ id: shifts.id }).from(shifts).limit(1);
    if (existingShifts.length === 0) {
      await db.insert(shifts).values(
        SHIFT_PRESETS.map((preset) => ({
          id: crypto.randomUUID(),
          name: preset.name,
          startTime: preset.start,
          endTime: preset.end,
          active: true,
          createdAt: now,
        })),
      );
    }

    return c.json({ userId, profileId }, 201);
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error ? error.message : "Could not create administrator",
      },
      400,
    );
  }
});

export default app;
