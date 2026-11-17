import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getProfile } from "./profiles";

export type TimelineEvent = {
  time: number;
  label: string;
  kind: "shift_start" | "shift_end" | "task_done" | "task_done_with_issue" | "issue_reported" | "shift_planned";
  detail?: string;
};

/** Caregiver's own timeline for a date. */
export const myTimeline = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const cg = await ctx.db
      .query("caregivers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    const me = cg[0];
    if (!me) return [];

    const tasks = await ctx.db
      .query("scheduledTasks")
      .withIndex("by_caregiverId_date", (q) => q.eq("caregiverId", me._id).eq("date", date))
      .collect();
    const templates = await Promise.all([...new Set(tasks.map((t) => t.templateId))].map((id) => ctx.db.get(id)));
    const issues = await ctx.db
      .query("issues")
      .withIndex("by_caregiverId", (q) => q.eq("caregiverId", me._id))
      .collect();
    const issuesByTask = new Map<string, any[]>();
    for (const i of issues) {
      const list = issuesByTask.get(i.scheduledTaskId) ?? [];
      list.push(i);
      issuesByTask.set(i.scheduledTaskId, list);
    }

    const events: TimelineEvent[] = [];
    const shiftStartMs = tasks[0]?.shiftStartMs;
    const shiftEndMs = tasks[0]?.shiftEndMs;

    if (tasks.length > 0) {
      if (shiftStartMs) events.push({ time: shiftStartMs, label: "Shift started", kind: "shift_start" });
      for (const t of tasks) {
        const tpl = templates.find((x) => x?._id === t.templateId);
        const taskIssues = issuesByTask.get(t._id) ?? [];
        if (t.completedAt) {
          events.push({
            time: t.completedAt,
            label: `${tpl?.name ?? "Task"} completed`,
            kind: taskIssues.length > 0 ? "task_done_with_issue" : "task_done",
          });
        }
        for (const i of taskIssues) {
          events.push({ time: i.createdAt, label: `Issue reported — ${i.issueType}`, kind: "issue_reported", detail: i.description });
        }
      }
      if (shiftEndMs && shiftEndMs <= Date.now()) {
        events.push({ time: shiftEndMs, label: "Shift ended", kind: "shift_end" });
      }
    }

    return events.sort((a, b) => a.time - b.time);
  },
  returns: v.any(),
});

/** Admin: any caregiver's timeline for a date. */
export const caregiverTimeline = query({
  args: { caregiverId: v.id("caregivers"), date: v.string() },
  handler: async (ctx, { caregiverId, date }) => {
    const admin = await getProfile(ctx);
    if (!admin || admin.role !== "admin") throw new Error("Admin only");

    const tasks = await ctx.db
      .query("scheduledTasks")
      .withIndex("by_caregiverId_date", (q) => q.eq("caregiverId", caregiverId).eq("date", date))
      .collect();
    const templates = await Promise.all([...new Set(tasks.map((t) => t.templateId))].map((id) => ctx.db.get(id)));
    const issues = await ctx.db
      .query("issues")
      .withIndex("by_caregiverId", (q) => q.eq("caregiverId", caregiverId))
      .collect();
    const issuesByTask = new Map<string, any[]>();
    for (const i of issues) {
      const list = issuesByTask.get(i.scheduledTaskId) ?? [];
      list.push(i);
      issuesByTask.set(i.scheduledTaskId, list);
    }

    const events: TimelineEvent[] = [];
    const shiftStartMs = tasks[0]?.shiftStartMs;
    const shiftEndMs = tasks[0]?.shiftEndMs;

    if (tasks.length > 0) {
      if (shiftStartMs) events.push({ time: shiftStartMs, label: "Shift started", kind: "shift_start" });
      for (const t of tasks) {
        const tpl = templates.find((x) => x?._id === t.templateId);
        const taskIssues = issuesByTask.get(t._id) ?? [];
        if (t.completedAt) {
          events.push({
            time: t.completedAt,
            label: `${tpl?.name ?? "Task"} completed`,
            kind: taskIssues.length > 0 ? "task_done_with_issue" : "task_done",
          });
        }
        for (const i of taskIssues) {
          events.push({ time: i.createdAt, label: `Issue reported — ${i.issueType}`, kind: "issue_reported", detail: i.description });
        }
      }
      if (shiftEndMs && shiftEndMs <= Date.now()) {
        events.push({ time: shiftEndMs, label: "Shift ended", kind: "shift_end" });
      }
    }

    return events.sort((a, b) => a.time - b.time);
  },
  returns: v.any(),
});
