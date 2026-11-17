import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getProfile, logAudit } from "./profiles";
import { isTimeInShiftWindow, minutesFromHHMM, msFrom } from "./shared";

// ── Shared queries ────────────────────────────────────────────────────────

/** Admin: all scheduled tasks for a date, joined with caregiver/template/shift names. */
export const adminTasksForDate = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const admin = await getProfile(ctx);
    if (!admin || admin.role !== "admin") throw new Error("Admin only");

    const tasks = await ctx.db
      .query("scheduledTasks")
      .withIndex("by_date", (q) => q.eq("date", date))
      .collect();
    return enrichTasks(ctx, tasks);
  },
  returns: v.any(),
});

/** Caregiver: only their own tasks for a date — enforced isolation. */
export const myTasksForDate = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const cg = await ctx.db
      .query("caregivers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    const me = cg[0];
    if (!me) throw new Error("No caregiver profile");
    const tasks = await ctx.db
      .query("scheduledTasks")
      .withIndex("by_caregiverId_date", (q) => q.eq("caregiverId", me._id).eq("date", date))
      .collect();
    return enrichTasks(ctx, tasks);
  },
  returns: v.any(),
});

export type EnrichedTask = {
  _id: Id<"scheduledTasks">;
  caregiverName: string;
  caregiverId: string;
  taskName: string;
  taskDescription?: string;
  category: string;
  priority: string;
  required: boolean;
  shiftName: string;
  shiftId: string;
  scheduledTime: string;
  dueMs: number;
  status: string;
  completedAt?: number | null;
  note?: string | null;
  issue?: {
    _id: string;
    issueType: string;
    description: string;
    status: string;
    createdAt: number;
  } | null;
};

async function enrichTasks(ctx: any, tasks: any[]): Promise<EnrichedTask[]> {
  const caregiverIds = [...new Set(tasks.map((t) => t.caregiverId))];
  const templateIds = [...new Set(tasks.map((t) => t.templateId))];
  const shiftIds = [...new Set(tasks.map((t) => t.shiftId))];
  const taskIds = tasks.map((t) => t._id);

  const caregivers = await Promise.all(caregiverIds.map((id) => ctx.db.get(id)));
  const templates = await Promise.all(templateIds.map((id) => ctx.db.get(id)));
  const shifts = await Promise.all(shiftIds.map((id) => ctx.db.get(id)));

  const issues = (
    await Promise.all(
      taskIds.map((id: Id<"scheduledTasks">) =>
        ctx.db.query("issues").withIndex("by_task", (q: any) => q.eq("scheduledTaskId", id)).collect(),
      ),
    )
  ).flat();

  const caregiverMap = new Map(caregivers.filter(Boolean).map((c: any) => [c._id, c]));
  const templateMap = new Map(templates.filter(Boolean).map((t: any) => [t._id, t]));
  const shiftMap = new Map(shifts.filter(Boolean).map((s: any) => [s._id, s]));
  const issuesByTask = new Map<string, any[]>();
  for (const issue of issues) {
    const list = issuesByTask.get(issue.scheduledTaskId) ?? [];
    list.push(issue);
    issuesByTask.set(issue.scheduledTaskId, list);
  }

  return tasks.map((t) => {
    const cg = caregiverMap.get(t.caregiverId);
    const user = cg ? undefined : undefined;
    void user;
    const tpl = templateMap.get(t.templateId);
    const shift = shiftMap.get(t.shiftId);
    const taskIssues = (issuesByTask.get(t._id) ?? []).sort((a, b) => b.createdAt - a.createdAt);
    return {
      _id: t._id,
      caregiverId: t.caregiverId,
      caregiverName: cg?.employeeCode ?? "Caregiver",
      taskName: tpl?.name ?? "Task",
      taskDescription: tpl?.description,
      category: tpl?.category ?? "",
      priority: tpl?.priority ?? "medium",
      required: tpl?.required ?? false,
      shiftId: t.shiftId,
      shiftName: shift?.name ?? "",
      scheduledTime: t.scheduledTime,
      dueMs: t.dueMs,
      status: t.status,
      completedAt: t.completedAt ?? null,
      note: t.note ?? null,
      issue: taskIssues[0]
        ? {
            _id: taskIssues[0]._id,
            issueType: taskIssues[0].issueType,
            description: taskIssues[0].description,
            status: taskIssues[0].status,
            createdAt: taskIssues[0].createdAt,
          }
        : null,
    };
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────

/** Caregiver marks a task complete — timestamps recorded server-side. */
export const completeTask = mutation({
  args: {
    taskId: v.id("scheduledTasks"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const me = await ctx.db
      .query("caregivers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    const caregiver = me[0];
    if (!caregiver) throw new Error("No caregiver profile");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    if (task.status !== "pending") throw new Error("Task is not pending");
    if (task.caregiverId !== caregiver._id) throw new Error("Not your task");

    const completedAt = Date.now();
    await ctx.db.patch(task._id, {
      status: "completed",
      completedAt,
      completedByUserId: userId,
      note: args.note || task.note,
    });
    await ctx.db.insert("taskCompletions", {
      scheduledTaskId: task._id,
      caregiverId: caregiver._id,
      completedAt,
      note: args.note,
    });
    await logAudit(ctx, userId, "task.completed", "scheduledTask", task._id, JSON.stringify({ status: "pending" }), JSON.stringify({ status: "completed", completedAt }));
  },
  returns: v.null(),
});

/** Caregiver adds/updates a note on their own task without completing it. */
export const addTaskNote = mutation({
  args: {
    taskId: v.id("scheduledTasks"),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const me = await ctx.db
      .query("caregivers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    const caregiver = me[0];
    if (!caregiver) throw new Error("No caregiver profile");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    if (task.caregiverId !== caregiver._id) throw new Error("Not your task");

    await ctx.db.patch(task._id, { note: args.note });
    await logAudit(ctx, userId, "task.note_added", "scheduledTask", task._id, task.note ?? undefined, args.note);
  },
  returns: v.null(),
});

/** Caregiver reports an issue on one of their tasks. */
export const reportIssue = mutation({
  args: {
    taskId: v.id("scheduledTasks"),
    issueType: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const me = await ctx.db
      .query("caregivers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    const caregiver = me[0];
    if (!caregiver) throw new Error("No caregiver profile");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    if (task.caregiverId !== caregiver._id) throw new Error("Not your task");

    await ctx.db.insert("issues", {
      scheduledTaskId: task._id,
      caregiverId: caregiver._id,
      issueType: args.issueType,
      description: args.description,
      status: "open",
      createdAt: Date.now(),
    });
    if (task.status === "pending") {
      await ctx.db.patch(task._id, { status: "completed_with_issue" });
    }
    await logAudit(ctx, userId, "issue.reported", "issue", task._id, undefined, `${args.issueType}: ${args.description}`);
  },
  returns: v.null(),
});

/** Admin adds a note / corrects a record with an audit trail. */
export const adminAddNote = mutation({
  args: {
    taskId: v.id("scheduledTasks"),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await getProfile(ctx);
    if (!admin || admin.role !== "admin") throw new Error("Admin only");
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    await ctx.db.patch(task._id, { note: args.note });
    await logAudit(ctx, admin.userId, "task.note_added", "scheduledTask", task._id, task.note ?? undefined, args.note);
  },
  returns: v.null(),
});

/** Admin generates one-off scheduled tasks for a specific caregiver/date (custom tasks). */
export const createOneOffTask = mutation({
  args: {
    templateId: v.id("taskTemplates"),
    caregiverId: v.id("caregivers"),
    date: v.string(),
    scheduledTime: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await getProfile(ctx);
    if (!admin || admin.role !== "admin") throw new Error("Admin only");
    const template = await ctx.db.get(args.templateId);
    if (!template || !template.active) throw new Error("Task template is inactive");
    const caregiver = await ctx.db.get(args.caregiverId);
    if (!caregiver || caregiver.status !== "active") throw new Error("Caregiver is inactive");

    const shiftId = caregiver.shiftId;
    if (!shiftId) throw new Error("Caregiver has no shift assigned");
    const shift = await ctx.db.get(shiftId);
    if (!shift) throw new Error("Shift not found");

    const dayStart = msFrom(args.date, "00:00");
    const sMin = minutesFromHHMM(shift.startTime);
    const eMin = minutesFromHHMM(shift.endTime);
    const dMin = minutesFromHHMM(args.scheduledTime);
    let dueMs = dayStart + dMin * 60000;
    if (dMin < sMin) dueMs += 86400000;
    let shiftEndMs = dayStart + eMin * 60000;
    if (eMin <= sMin) shiftEndMs += 86400000;
    void isTimeInShiftWindow;

    const id = await ctx.db.insert("scheduledTasks", {
      templateId: args.templateId,
      caregiverId: args.caregiverId,
      shiftId,
      date: args.date,
      scheduledTime: args.scheduledTime,
      dueMs,
      shiftStartMs: dayStart + sMin * 60000,
      shiftEndMs,
      status: "pending",
    });
    await logAudit(ctx, admin.userId, "task.created_one_off", "scheduledTask", id, undefined, template.name);
    return id;
  },
  returns: v.any(),
});
