import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { patients } from "@careshift/db";
import { getDb } from "../db";
import { requireAdmin, requireUser } from "../middleware/auth";
import type { Bindings, Variables } from "../env";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", requireUser);
app.use("*", requireAdmin);

const patientSchema = z.object({
  fullName: z.string().trim().min(1),
  preferredName: z.string().trim().optional(),
  aliases: z.array(z.string().trim().min(1)).optional(),
  dateOfBirth: z.string().trim().optional(),
  room: z.string().trim().optional(),
  address: z.string().trim().optional(),
  primaryContactName: z.string().trim().optional(),
  primaryContactPhone: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

app.get("/", async (c) => {
  const db = getDb(c.env);
  const rows = await db.select().from(patients).orderBy(asc(patients.fullName));
  return c.json(rows);
});

app.get("/:id", async (c) => {
  const db = getDb(c.env);
  const rows = await db
    .select()
    .from(patients)
    .where(eq(patients.id, c.req.param("id")))
    .limit(1);

  if (rows.length === 0) return c.json({ error: "Patient not found" }, 404);
  return c.json(rows[0]);
});

app.post("/", zValidator("json", patientSchema), async (c) => {
  const db = getDb(c.env);
  const body = c.req.valid("json");
  const id = crypto.randomUUID();

  await db.insert(patients).values({
    id,
    fullName: body.fullName,
    preferredName: body.preferredName ?? null,
    aliases: body.aliases ?? null,
    dateOfBirth: body.dateOfBirth ?? null,
    room: body.room ?? null,
    address: body.address ?? null,
    primaryContactName: body.primaryContactName ?? null,
    primaryContactPhone: body.primaryContactPhone ?? null,
    notes: body.notes ?? null,
    status: body.status ?? "active",
    createdAt: Date.now(),
  });

  const rows = await db
    .select()
    .from(patients)
    .where(eq(patients.id, id))
    .limit(1);
  return c.json(rows[0], 201);
});

app.patch("/:id", zValidator("json", patientSchema.partial()), async (c) => {
  const db = getDb(c.env);
  const body = c.req.valid("json");
  const updates = Object.fromEntries(
    Object.entries(body).filter(([, value]) => value !== undefined),
  );

  if (Object.keys(updates).length > 0) {
    await db
      .update(patients)
      .set(updates)
      .where(eq(patients.id, c.req.param("id")));
  }

  const rows = await db
    .select()
    .from(patients)
    .where(eq(patients.id, c.req.param("id")))
    .limit(1);

  if (rows.length === 0) return c.json({ error: "Patient not found" }, 404);
  return c.json(rows[0]);
});

export default app;
