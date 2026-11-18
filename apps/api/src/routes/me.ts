import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { shifts } from "@careshift/db";
import { getDb } from "../db";
import { requireUser } from "../middleware/auth";
import type { Bindings, Variables } from "../env";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", requireUser);

app.get("/", async (c) => {
  const profile = c.get("profile");
  const session = c.get("session");

  if (!profile) {
    return c.json({ user: session.user, profile: null });
  }

  let shift = null;
  if (profile.shiftId) {
    const db = getDb(c.env);
    const rows = await db
      .select()
      .from(shifts)
      .where(eq(shifts.id, profile.shiftId))
      .limit(1);
    shift = rows[0] ?? null;
  }

  return c.json({ user: session.user, profile, shift });
});

export default app;
