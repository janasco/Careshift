import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import { profiles } from "@careshift/db";
import { createAuth } from "../auth";
import { getDb } from "../db";
import type { Bindings, Variables } from "../env";

export const requireUser = createMiddleware<{
  Bindings: Bindings;
  Variables: Variables;
}>(async (c, next) => {
  const auth = createAuth(c.env);
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("session", session as Variables["session"]);

  const db = getDb(c.env);
  const rows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, session.user.id))
    .limit(1);

  c.set("profile", (rows[0] as Variables["profile"]) ?? null);
  await next();
});

export const requireAdmin = createMiddleware<{
  Bindings: Bindings;
  Variables: Variables;
}>(async (c, next) => {
  const profile = c.get("profile");
  if (!profile || profile.role !== "admin") {
    return c.json({ error: "Admin only" }, 403);
  }
  await next();
});
