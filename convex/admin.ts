import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getProfile } from "./profiles";

async function requireAdmin(ctx: any) {
  const admin = await getProfile(ctx);
  if (!admin || admin.role !== "admin") throw new Error("Admin only");
  return admin;
}

// ── Caregiver directory (admin) ───────────────────────────────────────────

export const caregiverDirectory = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const caregivers = await ctx.db.query("caregivers").collect();
    const profiles = await ctx.db.query("profiles").collect();
    const users = await ctx.db.query("users").collect();
    const shifts = await ctx.db.query("shifts").collect();

    return caregivers.map((cg) => {
      const profile = profiles.find((p) => p.userId === cg.userId);
      const user = users.find((u) => u._id === cg.userId);
      const shift = shifts.find((s) => s._id === cg.shiftId);
      return {
        _id: cg._id,
        profileId: profile?._id,
        userId: cg.userId,
        fullName: profile?.fullName ?? user?.name ?? "Caregiver",
        email: user?.email ?? "",
        phone: cg.phone ?? profile?.phone,
        employeeCode: cg.employeeCode ?? profile?.employeeCode,
        shiftId: cg.shiftId,
        shiftName: shift?.name,
        status: cg.status,
        hiredAt: cg.hiredAt,
        lastLoginAt: profile?.lastLoginAt,
      };
    });
  },
  returns: v.any(),
});

// ── Dashboard summary for a date ──────────────────────────────────────────

export const dashboardSummary = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    await requireAdmin(ctx);

    const tasks = await ctx.db
      .query("scheduledTasks")
      .withIndex("by_date", (q) => q.eq("date", date))
      .collect();
    const caregivers = await ctx.db.query("caregivers").collect();
    const profiles = await ctx.db.query("profiles").collect();
    const shifts = await ctx.db.query("shifts").collect();
    const templates = await ctx.db.query("taskTemplates").collect();

    const now = Date.now();
    const activeCaregivers = caregivers.filter((c) => c.status === "active");

    const tasksByCaregiver = new Map<string, typeof tasks>();
    for (const t of tasks) {
      const list = tasksByCaregiver.get(t.caregiverId) ?? [];
      list.push(t);
      tasksByCaregiver.set(t.caregiverId, list);
    }

    const caregiverStatus = activeCaregivers
      .map((cg) => {
        const profile = profiles.find((p) => p.userId === cg.userId);
        const shift = shifts.find((s) => s._id === cg.shiftId);
        const list = tasksByCaregiver.get(cg._id) ?? [];
        const completed = list.filter((t) => t.status === "completed").length;
        const withIssue = list.filter((t) => t.status === "completed_with_issue").length;
        const pending = list.filter((t) => t.status === "pending" && t.dueMs >= now).length;
        const overdue = list.filter((t) => t.status === "pending" && t.dueMs < now).length;
        const shiftStartMs = list[0]?.shiftStartMs ?? null;
        const shiftEndMs = list[0]?.shiftEndMs ?? null;

        let liveStatus: "completed" | "working" | "pending" | "overdue" | "upcoming" = "upcoming";
        if (shiftStartMs && shiftEndMs) {
          if (now < shiftStartMs) liveStatus = "upcoming";
          else if (now >= shiftEndMs) liveStatus = completed + withIssue === list.length && list.length > 0 ? "completed" : "overdue";
          else liveStatus = overdue > 0 ? "overdue" : "working";
        }

        return {
          caregiverId: cg._id,
          name: profile?.fullName ?? "Caregiver",
          shiftName: shift?.name ?? "No shift",
          shiftStart: shift?.startTime,
          shiftEnd: shift?.endTime,
          completed,
          withIssue,
          pending,
          overdue,
          total: list.length,
          liveStatus,
        };
      })
      .sort((a, b) => (a.shiftStart ?? "99") < (b.shiftStart ?? "99") ? -1 : 1);

    const completed = tasks.filter((t) => t.status === "completed").length;
    const withIssue = tasks.filter((t) => t.status === "completed_with_issue").length;
    const pending = tasks.filter((t) => t.status === "pending" && t.dueMs >= now).length;
    const overdue = tasks.filter((t) => t.status === "pending" && t.dueMs < now).length;
    const openIssues = await ctx.db.query("issues").withIndex("by_status", (q) => q.eq("status", "open")).collect();
    const todayIssues = openIssues.filter((i) => tasks.some((t) => t._id === i.scheduledTaskId));

    const shiftBreakdown = shifts
      .filter((s) => s.active)
      .map((s) => {
        const list = tasks.filter((t) => t.shiftId === s._id);
        const done = list.filter((t) => t.status === "completed").length;
        return {
          shiftId: s._id,
          name: s.name,
          total: list.length,
          completed: done,
          rate: list.length ? Math.round((done / list.length) * 100) : 0,
        };
      });

    return {
      date,
      now,
      totalCaregivers: activeCaregivers.length,
      totalTasks: tasks.length,
      completed,
      withIssue,
      pending,
      overdue,
      issues: todayIssues.length,
      completionRate: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
      caregiverStatus,
      shiftBreakdown,
      templatesCount: templates.filter((t) => t.active).length,
    };
  },
  returns: v.any(),
});

// ── History with filters ──────────────────────────────────────────────────

export const historySearch = query({
  args: {
    fromDate: v.string(),
    toDate: v.string(),
    caregiverId: v.optional(v.id("caregivers")),
    shiftId: v.optional(v.id("shifts")),
    templateId: v.optional(v.id("taskTemplates")),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const tasks = await ctx.db.query("scheduledTasks").collect();
    const templates = await ctx.db.query("taskTemplates").collect();
    const caregivers = await ctx.db.query("caregivers").collect();
    const profiles = await ctx.db.query("profiles").collect();
    const shifts = await ctx.db.query("shifts").collect();

    const filtered = tasks.filter((t) => {
      if (t.date < args.fromDate || t.date > args.toDate) return false;
      if (args.caregiverId && t.caregiverId !== args.caregiverId) return false;
      if (args.shiftId && t.shiftId !== args.shiftId) return false;
      if (args.templateId && t.templateId !== args.templateId) return false;
      if (args.status === "completed" && t.status !== "completed") return false;
      if (args.status === "pending" && !(t.status === "pending")) return false;
      if (args.status === "overdue" && !(t.status === "pending" && t.dueMs < Date.now())) return false;
      if (args.status === "issue" && !(t.status === "completed_with_issue")) return false;
      return true;
    });

    return filtered
      .map((t) => {
        const tpl = templates.find((x) => x._id === t.templateId);
        const cg = caregivers.find((x) => x._id === t.caregiverId);
        const profile = profiles.find((p) => p.userId === cg?.userId);
        const shift = shifts.find((x) => x._id === t.shiftId);
        return {
          _id: t._id,
          date: t.date,
          caregiverName: profile?.fullName ?? "Caregiver",
          shiftName: shift?.name ?? "",
          taskName: tpl?.name ?? "Task",
          category: tpl?.category ?? "",
          status: t.status,
          scheduledTime: t.scheduledTime,
          dueMs: t.dueMs,
          completedAt: t.completedAt,
          note: t.note,
          overdue: t.status === "pending" && t.dueMs < Date.now(),
        };
      })
      .sort((a, b) => (a.date + a.scheduledTime) < (b.date + b.scheduledTime) ? 1 : -1);
  },
  returns: v.any(),
});

// ── Issues (admin) ────────────────────────────────────────────────────────

export const allIssues = query({
  args: { status: v.optional(v.union(v.literal("open"), v.literal("resolved"))) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const issues = args.status
      ? await ctx.db.query("issues").withIndex("by_status", (q) => q.eq("status", args.status as "open" | "resolved")).collect()
      : await ctx.db.query("issues").collect(); // (no index when unfiltered)
    const tasks = await ctx.db.query("scheduledTasks").collect();
    const templates = await ctx.db.query("taskTemplates").collect();
    const caregivers = await ctx.db.query("caregivers").collect();
    const profiles = await ctx.db.query("profiles").collect();
    const shifts = await ctx.db.query("shifts").collect();

    return issues
      .map((i) => {
        const task = tasks.find((t) => t._id === i.scheduledTaskId);
        const tpl = task ? templates.find((x) => x._id === task.templateId) : undefined;
        const cg = caregivers.find((x) => x._id === i.caregiverId);
        const profile = profiles.find((p) => p.userId === cg?.userId);
        const shift = task ? shifts.find((x) => x._id === task.shiftId) : undefined;
        return {
          _id: i._id,
          issueType: i.issueType,
          description: i.description,
          status: i.status,
          createdAt: i.createdAt,
          resolvedAt: i.resolvedAt,
          caregiverName: profile?.fullName ?? "Caregiver",
          taskName: tpl?.name ?? "Task",
          shiftName: shift?.name ?? "",
          taskDate: task?.date,
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  },
  returns: v.any(),
});


