import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getProfile, logAudit } from "./profiles";

void getAuthUserId;

export const listShifts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("shifts").collect();
  },
  returns: v.any(),
});

export const upsertShift = mutation({
  args: {
    id: v.optional(v.id("shifts")),
    name: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const admin = await getProfile(ctx);
    if (!admin || admin.role !== "admin") throw new Error("Admin only");

    if (args.id) {
      const old = await ctx.db.get(args.id);
      await ctx.db.patch(args.id, {
        name: args.name,
        startTime: args.startTime,
        endTime: args.endTime,
        active: args.active,
      });
      await logAudit(ctx, admin._id, "shift.updated", "shift", args.id, JSON.stringify(old), JSON.stringify(args));
      return args.id;
    }

    const id = await ctx.db.insert("shifts", {
      name: args.name,
      startTime: args.startTime,
      endTime: args.endTime,
      active: args.active,
    });
    await logAudit(ctx, admin._id, "shift.created", "shift", id, undefined, args.name);
    return id as Id<"shifts">;
  },
  returns: v.any(),
});

export const setShiftActive = mutation({
  args: { id: v.id("shifts"), active: v.boolean() },
  handler: async (ctx, args) => {
    const admin = await getProfile(ctx);
    if (!admin || admin.role !== "admin") throw new Error("Admin only");
    const old = await ctx.db.get(args.id);
    await ctx.db.patch(args.id, { active: args.active });
    await logAudit(ctx, admin._id, args.active ? "shift.activated" : "shift.deactivated", "shift", args.id, JSON.stringify({ active: old?.active }), JSON.stringify({ active: args.active }));
  },
  returns: v.null(),
});

export const deleteShift = mutation({
  args: { id: v.id("shifts") },
  handler: async (ctx, args) => {
    const admin = await getProfile(ctx);
    if (!admin || admin.role !== "admin") throw new Error("Admin only");

    const shift = await ctx.db.get(args.id);
    if (!shift) throw new Error("Shift not found");

    const [caregivers, profiles, assignments, scheduledTasks, visits] = await Promise.all([
      ctx.db
        .query("caregivers")
        .withIndex("by_shiftId", (q) => q.eq("shiftId", args.id))
        .collect(),
      ctx.db.query("profiles").collect(),
      ctx.db
        .query("assignments")
        .withIndex("by_shiftId", (q) => q.eq("shiftId", args.id))
        .collect(),
      ctx.db
        .query("scheduledTasks")
        .withIndex("by_shiftId", (q) => q.eq("shiftId", args.id))
        .collect(),
      ctx.db
        .query("visits")
        .withIndex("by_shiftId", (q) => q.eq("shiftId", args.id))
        .collect(),
    ]);

    const profileRefs = profiles.filter((profile) => profile.shiftId === args.id).length;
    const references = [
      caregivers.length ? `${caregivers.length} caregiver${caregivers.length === 1 ? "" : "s"}` : null,
      profileRefs ? `${profileRefs} profile${profileRefs === 1 ? "" : "s"}` : null,
      assignments.length ? `${assignments.length} assignment${assignments.length === 1 ? "" : "s"}` : null,
      scheduledTasks.length ? `${scheduledTasks.length} scheduled task${scheduledTasks.length === 1 ? "" : "s"}` : null,
      visits.length ? `${visits.length} visit${visits.length === 1 ? "" : "s"}` : null,
    ].filter(Boolean);

    if (references.length > 0) {
      throw new Error(
        `Cannot delete "${shift.name}": it is referenced by ${references.join(", ")}. Reassign or remove those records, or deactivate the shift instead.`,
      );
    }

    await ctx.db.delete(args.id);
    await logAudit(ctx, admin._id, "shift.deleted", "shift", args.id, JSON.stringify(shift), undefined);
    return null;
  },
  returns: v.null(),
});
