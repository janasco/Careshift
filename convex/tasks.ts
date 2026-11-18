import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getProfile, logAudit } from "./profiles";

export const listTemplates = query({
  args: {},
  handler: (ctx) => ctx.db.query("taskTemplates").collect(),
  returns: v.any(),
});

export const saveTemplate = mutation({
  args: {
    id: v.optional(v.id("taskTemplates")),
    name: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    priority: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
    estimatedDuration: v.number(),
    required: v.boolean(),
    recurring: v.boolean(),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const admin = await getProfile(ctx);
    if (!admin || admin.role !== "admin") throw new Error("Admin only");
    if (args.id) {
      const old = await ctx.db.get(args.id);
      await ctx.db.patch(args.id, { ...args });
      await logAudit(ctx, admin._id, "task_template.updated", "taskTemplate", args.id, JSON.stringify(old), JSON.stringify(args));
      return args.id;
    }
    const id = await ctx.db.insert("taskTemplates", { ...args });
    await logAudit(ctx, admin._id, "task_template.created", "taskTemplate", id, undefined, args.name);
    return id;
  },
  returns: v.any(),
});

/** Soft-delete: templates with history are deactivated, never removed. */
export const deactivateTemplate = mutation({
  args: { id: v.id("taskTemplates") },
  handler: async (ctx, args) => {
    const admin = await deactivateAdminOrThrow(ctx);
    const old = await ctx.db.get(args.id);
    await ctx.db.patch(args.id, { active: false });
    // Also deactivate its assignments so no future tasks get generated.
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_template", (q) => q.eq("taskTemplateId", args.id))
      .collect();
    for (const a of assignments) await ctx.db.patch(a._id, { active: false });
    await logAudit(ctx, admin._id, "task_template.deactivated", "taskTemplate", args.id, JSON.stringify({ active: old?.active }), JSON.stringify({ active: false }));
  },
  returns: v.null(),
});

async function deactivateAdminOrThrow(ctx: any) {
  const admin = await getProfile(ctx);
  if (!admin || admin.role !== "admin") throw new Error("Admin only");
  return admin;
}
