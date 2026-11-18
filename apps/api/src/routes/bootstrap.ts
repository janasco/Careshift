import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  account,
  assignments,
  auditLogs,
  careEvents,
  caregivers,
  issues,
  medicationLogs,
  medications,
  patients,
  profiles,
  scheduledTasks,
  session,
  shifts,
  taskCompletions,
  taskTemplates,
  user,
  verification,
  visits,
  vitalSigns,
} from "@careshift/db";
import { SHIFT_PRESETS } from "@careshift/shared";
import { createAuth } from "../auth";
import { getDb } from "../db";
import { requireAdmin, requireUser } from "../middleware/auth";
import type { Bindings, Variables } from "../env";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

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

const STARTER_TEMPLATES = [
  { name: "Assist with bathing", category: "Personal Care", priority: "high", estimatedDuration: 45, required: true, description: "Assist with shower or bed bath per care plan" },
  { name: "Assist with dressing", category: "Personal Care", priority: "high", estimatedDuration: 30, required: true, description: "Help select and put on weather-appropriate clothing" },
  { name: "Oral hygiene", category: "Personal Care", priority: "medium", estimatedDuration: 15, required: true, description: "Brushing, denture care, mouth rinse" },
  { name: "Grooming", category: "Personal Care", priority: "low", estimatedDuration: 15, required: false, description: "Hair care, shaving, nail care as tolerated" },
  { name: "Check medication schedule", category: "Medication", priority: "high", estimatedDuration: 15, required: true, description: "Verify schedule and prepare doses" },
  { name: "Assist with medication", category: "Medication", priority: "high", estimatedDuration: 20, required: true, description: "Administer or prompt per medication plan" },
  { name: "Record medication observation", category: "Medication", priority: "medium", estimatedDuration: 10, required: true, description: "Note side effects, refusals, or concerns" },
  { name: "Prepare breakfast", category: "Meals", priority: "high", estimatedDuration: 30, required: true, description: "Prepare morning meal per dietary plan" },
  { name: "Prepare lunch", category: "Meals", priority: "high", estimatedDuration: 40, required: true, description: "Prepare and serve midday meal" },
  { name: "Prepare dinner", category: "Meals", priority: "high", estimatedDuration: 45, required: true, description: "Prepare and serve evening meal" },
  { name: "Record meal intake", category: "Meals", priority: "medium", estimatedDuration: 10, required: true, description: "Record appetite and intake percentage" },
  { name: "Clean room", category: "Housekeeping", priority: "low", estimatedDuration: 30, required: false, description: "Tidy and sanitize living area" },
  { name: "Change bed sheets", category: "Housekeeping", priority: "low", estimatedDuration: 20, required: false, description: "Strip and remake bed with fresh linens" },
  { name: "Laundry", category: "Housekeeping", priority: "low", estimatedDuration: 40, required: false, description: "Wash, dry, fold, and put away" },
  { name: "Organize personal items", category: "Housekeeping", priority: "low", estimatedDuration: 20, required: false, description: "Keep belongings accessible and ordered" },
  { name: "Check vital signs", category: "Monitoring", priority: "high", estimatedDuration: 15, required: true, description: "Temperature, pulse, blood pressure" },
  { name: "Check hydration", category: "Monitoring", priority: "medium", estimatedDuration: 10, required: true, description: "Offer water and record intake" },
  { name: "Check mobility", category: "Monitoring", priority: "medium", estimatedDuration: 15, required: true, description: "Safe walking, transfers, fall risk" },
  { name: "Record observations", category: "Monitoring", priority: "low", estimatedDuration: 10, required: true, description: "General wellbeing and behavior notes" },
] as const;

app.post("/seed-templates", requireUser, requireAdmin, async (c) => {
  const db = getDb(c.env);
  const existing = new Set(
    (await db.select({ name: taskTemplates.name }).from(taskTemplates)).map(
      (row) => row.name,
    ),
  );
  let added = 0;
  let skipped = 0;

  for (const template of STARTER_TEMPLATES) {
    if (existing.has(template.name)) {
      skipped += 1;
      continue;
    }
    await db.insert(taskTemplates).values({
      id: crypto.randomUUID(),
      name: template.name,
      description: template.description,
      category: template.category,
      priority: template.priority,
      estimatedDuration: template.estimatedDuration,
      required: template.required,
      recurring: true,
      active: true,
      createdAt: Date.now(),
    });
    added += 1;
  }

  return c.json({ added, skipped });
});

app.post("/reset", requireUser, requireAdmin, async (c) => {
  const db = getDb(c.env);

  await db.delete(taskCompletions);
  await db.delete(issues);
  await db.delete(scheduledTasks);
  await db.delete(assignments);
  await db.delete(medicationLogs);
  await db.delete(medications);
  await db.delete(careEvents);
  await db.delete(vitalSigns);
  await db.delete(visits);
  await db.delete(caregivers);
  await db.delete(profiles);
  await db.delete(taskTemplates);
  await db.delete(patients);
  await db.delete(auditLogs);
  await db.delete(account);
  await db.delete(session);
  await db.delete(verification);
  await db.delete(user);
  await db.delete(shifts);

  const now = Date.now();
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

  return c.json({ reset: true });
});

export default app;
