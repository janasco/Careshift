import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { pushTokens } from "@careshift/db";
import { getDb } from "../db";
import { sendPushToUsers } from "../lib/fcm";
import { requireAdmin, requireUser } from "../middleware/auth";
import type { Bindings, Variables } from "../env";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", requireUser);

const registerSchema = z.object({
  token: z.string().trim().min(20),
  platform: z.string().trim().min(1).max(20).default("android"),
});

const unregisterSchema = z.object({
  token: z.string().trim().min(20),
});

app.post("/tokens", zValidator("json", registerSchema), async (c) => {
  const profile = c.get("profile");
  if (!profile) return c.json({ error: "Profile not found" }, 403);

  const db = getDb(c.env);
  const body = c.req.valid("json");
  const now = Date.now();

  await db
    .insert(pushTokens)
    .values({
      id: crypto.randomUUID(),
      userId: profile.userId,
      token: body.token,
      platform: body.platform,
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: pushTokens.token,
      set: {
        userId: profile.userId,
        platform: body.platform,
        updatedAt: now,
        lastSeenAt: now,
      },
    });

  return c.json({ ok: true });
});

app.delete("/tokens", zValidator("json", unregisterSchema), async (c) => {
  const profile = c.get("profile");
  if (!profile) return c.json({ error: "Profile not found" }, 403);

  const db = getDb(c.env);
  const body = c.req.valid("json");
  await db
    .delete(pushTokens)
    .where(
      and(eq(pushTokens.token, body.token), eq(pushTokens.userId, profile.userId)),
    );

  return c.json({ ok: true });
});

app.post("/test", requireAdmin, async (c) => {
  const profile = c.get("profile");
  if (!profile) return c.json({ error: "Profile not found" }, 403);

  const result = await sendPushToUsers(c.env, getDb(c.env), [profile.userId], {
    title: "CareShift notifications are working",
    body: "You will receive medication, appointment, and task reminders here.",
    data: { kind: "test" },
  });

  return c.json(result);
});

export default app;
