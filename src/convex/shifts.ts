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
