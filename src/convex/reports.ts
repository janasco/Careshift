import { query } from "./_generated/server";
import { v } from "convex/values";
import { getProfile } from "./profiles";

async function requireAdmin(ctx: any) {
  const admin = await getProfile(ctx);
  if (!admin || admin.role !== "admin") throw new Error("Admin only");
  return admin;
}

// ── Daily report ──────────────────────────────────────────────────────────

export const dailyReport = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    await requireAdmin(ctx);
    const tasks = await ctx.db
      .query("scheduledTasks")
      .withIndex("by_date", (q) => q.eq("date", date))
      .collect();
    const caregivers = await ctx.db.query("caregivers").collect();
    const profiles = await ctx.db.query("profiles").collect();
    const templates = await ctx.db.query("taskTemplates").collect();

    const completed = tasks.filter((t) => t.status === "completed").length;
    const issuesCount = tasks.filter((t) => t.status === "completed_with_issue").length;
    const pending = tasks.filter((t) => t.status === "pending").length;

    const byCaregiver = caregivers
      .filter((c) => c.status === "active")
      .map((cg) => {
        const profile = profiles.find((p) => p.userId === cg.userId);
        const list = tasks.filter((t) => t.caregiverId === cg._id);
        const done = list.filter((t) => t.status === "completed").length;
        return {
          caregiverId: cg._id,
          name: profile?.fullName ?? "Caregiver",
          total: list.length,
          completed: done,
          missed: list.filter((t) => t.status === "pending" && t.dueMs < Date.now()).length,
          issues: list.filter((t) => t.status === "completed_with_issue").length,
          rate: list.length ? Math.round((done / list.length) * 100) : 0,
        };
      });

    const withNotes = tasks
      .filter((t) => t.note)
      .map((t) => {
        const tpl = templates.find((x) => x._id === t.templateId);
        const cg = caregivers.find((x) => x._id === t.caregiverId);
        const profile = profiles.find((p) => p.userId === cg?.userId);
        return {
          taskId: t._id,
          caregiverName: profile?.fullName ?? "",
          taskName: tpl?.name ?? "",
          note: t.note!,
        };
      });

    return {
      date,
      total: tasks.length,
      completed,
      pending,
      overdue: tasks.filter((t) => t.status === "pending" && t.dueMs < Date.now()).length,
      issuesCount,
      completionRate: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
      byCaregiver,
      notes: withNotes,
    };
  },
  returns: v.any(),
});

// ── Caregiver report over a date range ────────────────────────────────────

export const caregiverReport = query({
  args: { caregiverId: v.id("caregivers"), fromDate: v.string(), toDate: v.string() },
  handler: async (ctx, { caregiverId, fromDate, toDate }) => {
    await requireAdmin(ctx);
    const all = await ctx.db
      .query("scheduledTasks")
      .withIndex("by_caregiverId_date", (q) => q.eq("caregiverId", caregiverId))
      .collect();
    const tasks = all.filter((t) => t.date >= fromDate && t.date <= toDate);
    const completedTasks = tasks.filter((t) => t.completedAt);

    let totalLateness = 0;
    for (const t of completedTasks) {
      totalLateness += Math.max(0, t.completedAt! - t.dueMs);
    }

    const profiles = await ctx.db.query("profiles").collect();
    const cg = await ctx.db.get(caregiverId);
    const profile = profiles.find((p) => p.userId === cg?.userId);

    return {
      caregiverName: profile?.fullName ?? "Caregiver",
      fromDate,
      toDate,
      total: tasks.length,
      completed: tasks.filter((t) => t.status === "completed").length,
      missed: tasks.filter((t) => t.status === "pending" && t.dueMs < Date.now()).length,
      issuesReported: tasks.filter((t) => t.status === "completed_with_issue").length,
      avgMinutesLate: completedTasks.length ? Math.round(totalLateness / completedTasks.length / 60000) : 0,
      completionRate: tasks.length
        ? Math.round((tasks.filter((t) => t.status === "completed").length / tasks.length) * 100)
        : 0,
    };
  },
  returns: v.any(),
});

// ── Shift report over a date range ────────────────────────────────────────

export const shiftReport = query({
  args: { fromDate: v.string(), toDate: v.string() },
  handler: async (ctx, { fromDate, toDate }) => {
    await requireAdmin(ctx);
    const shifts = await ctx.db.query("shifts").collect();
    const all = await ctx.db.query("scheduledTasks").collect();
    const tasks = all.filter((t) => t.date >= fromDate && t.date <= toDate);

    return shifts
      .filter((s) => s.active)
      .map((s) => {
        const list = tasks.filter((t) => t.shiftId === s._id);
        const done = list.filter((t) => t.status === "completed").length;
        return {
          shiftId: s._id,
          name: s.name,
          startTime: s.startTime,
          endTime: s.endTime,
          total: list.length,
          completed: done,
          pending: list.filter((t) => t.status === "pending").length,
          issues: list.filter((t) => t.status === "completed_with_issue").length,
          rate: list.length ? Math.round((done / list.length) * 100) : 0,
        };
      });
  },
  returns: v.any(),
});

// ── Trend: completions per day over a range (for charts) ──────────────────

export const trendReport = query({
  args: { fromDate: v.string(), toDate: v.string() },
  handler: async (ctx, { fromDate, toDate }) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("scheduledTasks").collect();
    const tasks = all.filter((t) => t.date >= fromDate && t.date <= toDate);

    const dates = [...new Set(tasks.map((t) => t.date))].sort();
    return dates.map((d) => {
      const list = tasks.filter((t) => t.date === d);
      const done = list.filter((t) => t.status === "completed").length;
      return {
        date: d,
        total: list.length,
        completed: done,
        rate: list.length ? Math.round((done / list.length) * 100) : 0,
      };
    });
  },
  returns: v.any(),
});
