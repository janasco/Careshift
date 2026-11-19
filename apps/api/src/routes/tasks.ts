import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import {
  assignments,
  caregivers,
  issues,
  patients,
  profiles,
  scheduledTasks,
  shifts,
  taskCompletions,
  taskTemplates,
} from "@careshift/db";
import { getDb, type Db } from "../db";
import { logAudit } from "../lib/audit";
import { requireAdmin, requireUser } from "../middleware/auth";
import type { Bindings, Variables } from "../env";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", requireUser);

async function enrichTasks(
  db: Db,
  tasks: Array<typeof scheduledTasks.$inferSelect>,
) {
  if (tasks.length === 0) return [];

  const caregiverIds = Array.from(new Set(tasks.map((task) => task.caregiverId)));
  const templateIds = Array.from(new Set(tasks.map((task) => task.templateId)));
  const shiftIds = Array.from(new Set(tasks.map((task) => task.shiftId)));
  const patientIds = Array.from(
    new Set(tasks.map((task) => task.patientId).filter((id): id is string => Boolean(id))),
  );
  const taskIds = tasks.map((task) => task.id);

  const caregiverRows =
    caregiverIds.length > 0
      ? await db
          .select()
          .from(caregivers)
          .where(inArray(caregivers.id, caregiverIds))
      : [];
  const userIds = caregiverRows.map((caregiver) => caregiver.userId);
  const profileRows =
    userIds.length > 0
      ? await db.select().from(profiles).where(inArray(profiles.userId, userIds))
      : [];
  const templateRows =
    templateIds.length > 0
      ? await db
          .select()
          .from(taskTemplates)
          .where(inArray(taskTemplates.id, templateIds))
      : [];
  const shiftRows =
    shiftIds.length > 0
      ? await db.select().from(shifts).where(inArray(shifts.id, shiftIds))
      : [];
  const patientRows =
    patientIds.length > 0
      ? await db.select().from(patients).where(inArray(patients.id, patientIds))
      : [];
  const issueRows =
    taskIds.length > 0
      ? await db
          .select()
          .from(issues)
          .where(inArray(issues.scheduledTaskId, taskIds))
      : [];

  return tasks.map((task) => {
    const caregiver = caregiverRows.find((row) => row.id === task.caregiverId);
    const profile = profileRows.find((row) => row.userId === caregiver?.userId);
    const template = templateRows.find((row) => row.id === task.templateId);
    const shift = shiftRows.find((row) => row.id === task.shiftId);
    const patient = patientRows.find((row) => row.id === task.patientId);
    const taskIssues = issueRows
      .filter((row) => row.scheduledTaskId === task.id)
      .sort((a, b) => b.createdAt - a.createdAt);
    const issue = taskIssues[0];

    return {
      ...task,
      _id: task.id,
      caregiverName: profile?.fullName ?? caregiver?.employeeCode ?? "Caregiver",
      taskName: template?.name ?? "Task",
      taskDescription: template?.description,
      category: template?.category ?? "",
      priority: template?.priority ?? "medium",
      required: template?.required ?? false,
      shiftName: shift?.name ?? "",
      patientName: patient?.fullName ?? "Unspecified",
      completedAt: task.completedAt ?? null,
      note: task.note ?? null,
      issue: issue
        ? {
            _id: issue.id,
            issueType: issue.issueType,
            description: issue.description,
            status: issue.status,
            createdAt: issue.createdAt,
          }
        : null,
    };
  });
}

const templateSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  category: z.string().trim().min(1),
  priority: z.enum(["high", "medium", "low"]),
  estimatedDuration: z.number().int().min(1),
  required: z.boolean().optional(),
  recurring: z.boolean().optional(),
  active: z.boolean().optional(),
});

const assignmentSchema = z.object({
  taskTemplateId: z.string().min(1),
  shiftId: z.string().min(1),
  caregiverId: z.string().min(1).nullable().optional(),
  patientId: z.string().min(1).nullable().optional(),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/),
  dueTime: z.string().regex(/^\d{2}:\d{2}$/),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  active: z.boolean().optional(),
});

app.get("/templates", async (c) => {
  const db = getDb(c.env);
  const rows = await db.select().from(taskTemplates);
  return c.json(rows);
});

app.post(
  "/templates",
  requireAdmin,
  zValidator("json", templateSchema),
  async (c) => {
    const db = getDb(c.env);
    const body = c.req.valid("json");
    const id = crypto.randomUUID();

    await db.insert(taskTemplates).values({
      id,
      name: body.name,
      description: body.description ?? null,
      category: body.category,
      priority: body.priority,
      estimatedDuration: body.estimatedDuration,
      required: body.required ?? true,
      recurring: body.recurring ?? true,
      active: body.active ?? true,
      createdAt: Date.now(),
    });

    await logAudit(db, {
      userId: c.get("session").user.id,
      action: "task_template.created",
      entityType: "task_template",
      entityId: id,
      newValue: body.name,
    });

    const rows = await db
      .select()
      .from(taskTemplates)
      .where(eq(taskTemplates.id, id));
    return c.json(rows[0], 201);
  },
);

app.patch(
  "/templates/:id",
  requireAdmin,
  zValidator("json", templateSchema.partial()),
  async (c) => {
    const db = getDb(c.env);
    const id = c.req.param("id");
    const body = c.req.valid("json");
    const updates = Object.fromEntries(
      Object.entries(body).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(updates).length > 0) {
      await db
        .update(taskTemplates)
        .set(updates)
        .where(eq(taskTemplates.id, id));
    }
    const rows = await db
      .select()
      .from(taskTemplates)
      .where(eq(taskTemplates.id, id));
    return c.json(rows[0]);
  },
);

app.delete("/templates/:id", requireAdmin, async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");
  await db
    .update(taskTemplates)
    .set({ active: false })
    .where(eq(taskTemplates.id, id));
  await logAudit(db, {
    userId: c.get("session").user.id,
    action: "task_template.deactivated",
    entityType: "task_template",
    entityId: id,
  });
  return c.json({ ok: true });
});

app.get("/assignments", async (c) => {
  const db = getDb(c.env);
  const rows = await db
    .select({
      id: assignments.id,
      taskTemplateId: assignments.taskTemplateId,
      taskName: taskTemplates.name,
      shiftId: assignments.shiftId,
      shiftName: shifts.name,
      caregiverId: assignments.caregiverId,
      caregiverName: profiles.fullName,
      patientId: assignments.patientId,
      patientName: patients.fullName,
      scheduledTime: assignments.scheduledTime,
      dueTime: assignments.dueTime,
      daysOfWeek: assignments.daysOfWeek,
      active: assignments.active,
    })
    .from(assignments)
    .leftJoin(taskTemplates, eq(taskTemplates.id, assignments.taskTemplateId))
    .leftJoin(shifts, eq(shifts.id, assignments.shiftId))
    .leftJoin(caregivers, eq(caregivers.id, assignments.caregiverId))
    .leftJoin(profiles, eq(profiles.userId, caregivers.userId))
    .leftJoin(patients, eq(patients.id, assignments.patientId));
  return c.json(rows);
});

app.post(
  "/assignments",
  requireAdmin,
  zValidator("json", assignmentSchema),
  async (c) => {
    const db = getDb(c.env);
    const body = c.req.valid("json");
    const id = crypto.randomUUID();
    await db.insert(assignments).values({
      id,
      taskTemplateId: body.taskTemplateId,
      shiftId: body.shiftId,
      caregiverId: body.caregiverId ?? null,
      patientId: body.patientId ?? null,
      scheduledTime: body.scheduledTime,
      dueTime: body.dueTime,
      daysOfWeek: body.daysOfWeek,
      active: body.active ?? true,
      createdAt: Date.now(),
    });
    await logAudit(db, {
      userId: c.get("session").user.id,
      action: "assignment.created",
      entityType: "assignment",
      entityId: id,
      newValue: body.taskTemplateId,
    });
    const rows = await db
      .select()
      .from(assignments)
      .where(eq(assignments.id, id));
    return c.json(rows[0], 201);
  },
);

app.patch(
  "/assignments/:id",
  requireAdmin,
  zValidator("json", assignmentSchema.partial()),
  async (c) => {
    const db = getDb(c.env);
    const id = c.req.param("id");
    const body = c.req.valid("json");
    const updates = Object.fromEntries(
      Object.entries(body).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(updates).length > 0) {
      await db.update(assignments).set(updates).where(eq(assignments.id, id));
    }
    const rows = await db
      .select()
      .from(assignments)
      .where(eq(assignments.id, id));
    return c.json(rows[0]);
  },
);

app.delete("/assignments/:id", requireAdmin, async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");
  await db.delete(assignments).where(eq(assignments.id, id));
  await logAudit(db, {
    userId: c.get("session").user.id,
    action: "assignment.deleted",
    entityType: "assignment",
    entityId: id,
  });
  return c.json({ ok: true });
});

app.post(
  "/materialize",
  zValidator("json", z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })),
  async (c) => {
    const db = getDb(c.env);
    const { date } = c.req.valid("json");
    const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay();
    const offsetMs =
      Number(c.env.TIMEZONE_OFFSET_MINUTES ?? "480") * 60 * 1000;

    const activeAssignments = await db
      .select()
      .from(assignments)
      .where(eq(assignments.active, true));
    const activeCaregivers = await db
      .select()
      .from(caregivers)
      .where(eq(caregivers.status, "active"));
    const shiftRows = await db.select().from(shifts);
    const existing = await db
      .select({
        assignmentId: scheduledTasks.assignmentId,
        caregiverId: scheduledTasks.caregiverId,
      })
      .from(scheduledTasks)
      .where(eq(scheduledTasks.date, date));

    let created = 0;
    let skipped = 0;

    for (const assignment of activeAssignments) {
      if (!assignment.daysOfWeek.includes(dayOfWeek)) continue;
      const shift = shiftRows.find((row) => row.id === assignment.shiftId);
      if (!shift) continue;

      const targets = assignment.caregiverId
        ? activeCaregivers.filter((row) => row.id === assignment.caregiverId)
        : activeCaregivers.filter((row) => row.shiftId === assignment.shiftId);

      for (const caregiver of targets) {
        const exists = existing.some(
          (row) =>
            row.assignmentId === assignment.id &&
            row.caregiverId === caregiver.id,
        );
        if (exists) {
          skipped += 1;
          continue;
        }

        const startMs = Date.parse(`${date}T${shift.startTime}:00Z`) - offsetMs;
        let endMs = Date.parse(`${date}T${shift.endTime}:00Z`) - offsetMs;
        let dueMs = Date.parse(`${date}T${assignment.dueTime}:00Z`) - offsetMs;
        if (Number.isNaN(startMs) || Number.isNaN(endMs) || Number.isNaN(dueMs)) {
          skipped += 1;
          continue;
        }
        if (shift.endTime <= shift.startTime) endMs += 24 * 60 * 60 * 1000;
        if (assignment.dueTime <= shift.startTime) {
          dueMs += 24 * 60 * 60 * 1000;
        }

        await db.insert(scheduledTasks).values({
          id: crypto.randomUUID(),
          assignmentId: assignment.id,
          templateId: assignment.taskTemplateId,
          caregiverId: caregiver.id,
          patientId: assignment.patientId ?? null,
          shiftId: assignment.shiftId,
          date,
          scheduledTime: assignment.scheduledTime,
          dueMs,
          shiftStartMs: startMs,
          shiftEndMs: endMs,
          status: "pending",
          createdAt: Date.now(),
        });
        created += 1;
      }
    }

    return c.json({ created, skipped });
  },
);

app.get("/checklist/my-tasks", async (c) => {
  const profile = c.get("profile");
  if (!profile || profile.role !== "caregiver") {
    return c.json({ error: "Caregiver only" }, 403);
  }
  const date = c.req.query("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ error: "Invalid date" }, 400);
  }

  const db = getDb(c.env);
  const caregiverRows = await db
    .select()
    .from(caregivers)
    .where(eq(caregivers.userId, profile.userId))
    .limit(1);
  const caregiver = caregiverRows[0];
  if (!caregiver) return c.json({ error: "Caregiver record not found" }, 404);

  const rows = await db
    .select()
    .from(scheduledTasks)
    .where(
      and(
        eq(scheduledTasks.caregiverId, caregiver.id),
        eq(scheduledTasks.date, date),
      ),
    );

  return c.json(await enrichTasks(db, rows));
});

app.get("/admin", requireAdmin, async (c) => {
  const date = c.req.query("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ error: "Invalid date" }, 400);
  }
  const db = getDb(c.env);
  const rows = await db
    .select()
    .from(scheduledTasks)
    .where(eq(scheduledTasks.date, date));
  return c.json(await enrichTasks(db, rows));
});

app.post(
  "/one-off",
  requireAdmin,
  zValidator(
    "json",
    z.object({
      templateId: z.string().min(1),
      caregiverId: z.string().min(1),
      patientId: z.string().min(1).optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      scheduledTime: z.string().regex(/^\d{1,2}:\d{2}$/),
    }),
  ),
  async (c) => {
    const db = getDb(c.env);
    const body = c.req.valid("json");
    const templateRows = await db
      .select()
      .from(taskTemplates)
      .where(eq(taskTemplates.id, body.templateId))
      .limit(1);
    const template = templateRows[0];
    if (!template || !template.active) {
      return c.json({ error: "Task template is inactive" }, 400);
    }
    const caregiverRows = await db
      .select()
      .from(caregivers)
      .where(eq(caregivers.id, body.caregiverId))
      .limit(1);
    const caregiver = caregiverRows[0];
    if (!caregiver || caregiver.status !== "active") {
      return c.json({ error: "Caregiver is inactive" }, 400);
    }
    if (!caregiver.shiftId) {
      return c.json({ error: "Caregiver has no shift assigned" }, 400);
    }
    const shiftRows = await db
      .select()
      .from(shifts)
      .where(eq(shifts.id, caregiver.shiftId))
      .limit(1);
    const shift = shiftRows[0];
    if (!shift) return c.json({ error: "Shift not found" }, 400);

    const offsetMs =
      Number(c.env.TIMEZONE_OFFSET_MINUTES ?? "480") * 60 * 1000;
    const startMs = Date.parse(`${body.date}T${shift.startTime}:00Z`) - offsetMs;
    let endMs = Date.parse(`${body.date}T${shift.endTime}:00Z`) - offsetMs;
    let dueMs = Date.parse(`${body.date}T${body.scheduledTime}:00Z`) - offsetMs;
    if (shift.endTime <= shift.startTime) endMs += 24 * 60 * 60 * 1000;
    if (body.scheduledTime <= shift.startTime) dueMs += 24 * 60 * 60 * 1000;

    const id = crypto.randomUUID();
    await db.insert(scheduledTasks).values({
      id,
      assignmentId: null,
      templateId: template.id,
      caregiverId: caregiver.id,
      patientId: body.patientId ?? null,
      shiftId: shift.id,
      date: body.date,
      scheduledTime: body.scheduledTime,
      dueMs,
      shiftStartMs: startMs,
      shiftEndMs: endMs,
      status: "pending",
      createdAt: Date.now(),
    });

    await logAudit(db, {
      userId: c.get("session").user.id,
      action: "task.one_off_created",
      entityType: "scheduled_task",
      entityId: id,
      newValue: template.name,
    });

    const rows = await db
      .select()
      .from(scheduledTasks)
      .where(eq(scheduledTasks.id, id));
    return c.json((await enrichTasks(db, rows))[0], 201);
  },
);

app.post(
  "/checklist/complete",
  zValidator(
    "json",
    z.object({
      taskId: z.string().min(1),
      note: z.string().trim().optional(),
    }),
  ),
  async (c) => {
    return updateTask(c, "completed");
  },
);

app.post(
  "/checklist/issue",
  zValidator(
    "json",
    z.object({
      taskId: z.string().min(1),
      issueType: z.string().trim().min(1),
      description: z.string().trim().min(3),
    }),
  ),
  async (c) => {
    const profile = c.get("profile");
    if (!profile || profile.role !== "caregiver") {
      return c.json({ error: "Caregiver only" }, 403);
    }
    const db = getDb(c.env);
    const body = c.req.valid("json");
    const caregiverId = await getCaregiverId(db, profile.userId);
    if (!caregiverId) return c.json({ error: "Caregiver record not found" }, 404);

    const rows = await db
      .select()
      .from(scheduledTasks)
      .where(
        and(
          eq(scheduledTasks.id, body.taskId),
          eq(scheduledTasks.caregiverId, caregiverId),
        ),
      )
      .limit(1);
    const task = rows[0];
    if (!task) return c.json({ error: "Task not found" }, 404);

    const now = Date.now();
    await db
      .update(scheduledTasks)
      .set({
        status: "completed_with_issue",
        completedAt: now,
        completedByUserId: profile.userId,
      })
      .where(eq(scheduledTasks.id, task.id));

    const issueId = crypto.randomUUID();
    await db.insert(issues).values({
      id: issueId,
      scheduledTaskId: task.id,
      caregiverId,
      issueType: body.issueType,
      description: body.description,
      status: "open",
      createdAt: now,
    });

    await logAudit(db, {
      userId: profile.userId,
      action: "task.issue_reported",
      entityType: "scheduled_task",
      entityId: task.id,
      newValue: body.issueType,
    });

    return c.json({ ok: true, issueId });
  },
);

app.post(
  "/checklist/note",
  zValidator(
    "json",
    z.object({
      taskId: z.string().min(1),
      note: z.string().trim().min(1),
    }),
  ),
  async (c) => {
    const profile = c.get("profile");
    if (!profile || profile.role !== "caregiver") {
      return c.json({ error: "Caregiver only" }, 403);
    }
    const db = getDb(c.env);
    const body = c.req.valid("json");
    const caregiver = await getCaregiverId(db, profile.userId);
    if (!caregiver) return c.json({ error: "Caregiver record not found" }, 404);

    const rows = await db
      .select()
      .from(scheduledTasks)
      .where(
        and(
          eq(scheduledTasks.id, body.taskId),
          eq(scheduledTasks.caregiverId, caregiver),
        ),
      )
      .limit(1);
    if (rows.length === 0) return c.json({ error: "Task not found" }, 404);

    await db
      .update(scheduledTasks)
      .set({ note: body.note })
      .where(eq(scheduledTasks.id, body.taskId));
    await logAudit(db, {
      userId: profile.userId,
      action: "task.note_added",
      entityType: "scheduled_task",
      entityId: body.taskId,
      newValue: body.note,
    });
    return c.json({ ok: true });
  },
);

async function getCaregiverId(db: Db, userId: string) {
  const rows = await db
    .select({ id: caregivers.id })
    .from(caregivers)
    .where(eq(caregivers.userId, userId))
    .limit(1);
  return rows[0]?.id ?? null;
}

async function updateTask(c: any, status: "completed" | "completed_with_issue") {
  const profile = c.get("profile");
  if (!profile || profile.role !== "caregiver") {
    return c.json({ error: "Caregiver only" }, 403);
  }
  const db = getDb(c.env);
  const body = c.req.valid("json");
  const caregiverId = await getCaregiverId(db, profile.userId);
  if (!caregiverId) return c.json({ error: "Caregiver record not found" }, 404);

  const rows = await db
    .select()
    .from(scheduledTasks)
    .where(
      and(
        eq(scheduledTasks.id, body.taskId),
        eq(scheduledTasks.caregiverId, caregiverId),
      ),
    )
    .limit(1);
  const task = rows[0];
  if (!task) return c.json({ error: "Task not found" }, 404);

  const now = Date.now();
  await db
    .update(scheduledTasks)
    .set({
      status,
      completedAt: now,
      completedByUserId: profile.userId,
      ...(body.note ? { note: body.note } : {}),
    })
    .where(eq(scheduledTasks.id, task.id));

  if (status === "completed") {
    await db.insert(taskCompletions).values({
      id: crypto.randomUUID(),
      scheduledTaskId: task.id,
      caregiverId,
      completedAt: now,
      note: body.note ?? null,
      createdAt: now,
    });
  }

  await logAudit(db, {
    userId: profile.userId,
    action: status === "completed" ? "task.completed" : "task.issue_reported",
    entityType: "scheduled_task",
    entityId: task.id,
    newValue: String(now),
  });

  return c.json({ ok: true });
}

export default app;
