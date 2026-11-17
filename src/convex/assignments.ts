import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getProfile, logAudit } from "./profiles";
import { minutesFromHHMM } from "./shared";
import type { Id } from "./_generated/dataModel";

export const listAssignments = query({
  args: {},
  handler: (ctx) => ctx.db.query("assignments").collect(),
  returns: v.any(),
});

export const saveAssignment = mutation({
  args: {
    id: v.optional(v.id("assignments")),
    taskTemplateId: v.id("taskTemplates"),
    shiftId: v.id("shifts"),
    caregiverId: v.optional(v.id("caregivers")),
    scheduledTime: v.string(),
    dueTime: v.string(),
    daysOfWeek: v.array(v.number()),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const admin = await getProfile(ctx);
    if (!admin || admin.role !== "admin") throw new Error("Admin only");

    if (args.id) {
      const old = await ctx.db.get(args.id);
      await ctx.db.patch(args.id, { ...args });
      await logAudit(ctx, admin._id, "assignment.updated", "assignment", args.id, JSON.stringify(old), JSON.stringify(args));
      return args.id;
    }
    const id = await ctx.db.insert("assignments", { ...args });
    await logAudit(ctx, admin._id, "assignment.created", "assignment", id, undefined, JSON.stringify(args));
    return id;
  },
  returns: v.any(),
});

export const setAssignmentActive = mutation({
  args: { id: v.id("assignments"), active: v.boolean() },
  handler: async (ctx, args) => {
    const admin = await getProfile(ctx);
    if (!admin || admin.role !== "admin") throw new Error("Admin only");
    const old = await ctx.db.get(args.id);
    await ctx.db.patch(args.id, { active: args.active });
    await logAudit(ctx, admin._id, args.active ? "assignment.activated" : "assignment.deactivated", "assignment", args.id, JSON.stringify({ active: old?.active }), JSON.stringify({ active: args.active }));
  },
  returns: v.null(),
});

/** Materializes a day's recurring assignments into concrete scheduledTasks. Idempotent per (assignment, caregiver, date). */
export const materializeDay = mutation({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first");

    const assignments = await ctx.db.query("assignments").collect();
    const templates = await ctx.db.query("taskTemplates").collect();
    const shifts = await ctx.db.query("shifts").collect();
    const caregivers = await ctx.db.query("caregivers").collect();
    const profileByUser = new Map<string, { active: boolean }>();
    for (const p of await ctx.db.query("profiles").collect()) {
      profileByUser.set(p.userId, p);
    }

    const weekday = new Date(date + "T00:00:00").getDay();
    const existing = await ctx.db
      .query("scheduledTasks")
      .withIndex("by_date", (q) => q.eq("date", date))
      .collect();
    const existingKey = new Set(existing.map((t) => `${t.assignmentId}|${t.caregiverId}|${t.date}`));

    for (const a of assignments) {
      if (!a.active) continue;
      if (!a.daysOfWeek.includes(weekday)) continue;
      const tpl = templates.find((t) => t._id === a.taskTemplateId && t.active);
      const shift = shifts.find((s) => s._id === a.shiftId && s.active);
      if (!tpl || !shift) continue;

      let caregiverId: Id<"caregivers"> | undefined = a.caregiverId ?? undefined;
      if (!caregiverId) {
        const candidates = caregivers.filter(
          (c) => c.status === "active" && (c.shiftId === a.shiftId || !c.shiftId),
        );
        const found = candidates.find((c) => profileByUser.get(c.userId)?.active);
        caregiverId = found?._id;
      }
      if (!caregiverId) continue;

      const sMin = minutesFromHHMM(shift.startTime);
      const eMin = minutesFromHHMM(shift.endTime);
      const dMin = minutesFromHHMM(a.dueTime);
      const dayStartMs = new Date(date + "T00:00:00").getTime();

      const shiftStartMs = dayStartMs + sMin * 60000;
      let shiftEndMs = dayStartMs + eMin * 60000;
      if (eMin <= sMin) shiftEndMs += 24 * 3600000;
      let dueMs = dayStartMs + dMin * 60000;
      if (dMin < sMin) dueMs += 24 * 3600000;

      const key = `${a._id}|${caregiverId}|${date}`;
      if (existingKey.has(key)) continue;

      await ctx.db.insert("scheduledTasks", {
        assignmentId: a._id,
        templateId: tpl._id,
        caregiverId,
        shiftId: shift._id,
        date,
        scheduledTime: a.scheduledTime,
        dueMs,
        shiftStartMs,
        shiftEndMs,
        status: "pending",
      });
    }
    return true;
  },
  returns: v.boolean(),
});
