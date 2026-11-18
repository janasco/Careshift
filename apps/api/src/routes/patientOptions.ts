import { Hono } from "hono";
import { asc, eq } from "drizzle-orm";
import { patients } from "@careshift/db";
import { getDb } from "../db";
import { requireUser } from "../middleware/auth";
import type { Bindings, Variables } from "../env";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", requireUser);

app.get("/", async (c) => {
  const db = getDb(c.env);
  const rows = await db
    .select({
      id: patients.id,
      fullName: patients.fullName,
      preferredName: patients.preferredName,
    })
    .from(patients)
    .where(eq(patients.status, "active"))
    .orderBy(asc(patients.fullName));

  return c.json(rows);
});

export default app;
