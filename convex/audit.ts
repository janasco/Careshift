import { query } from "./_generated/server";
import { v } from "convex/values";
import { getProfile } from "./profiles";

export const listAuditLogs = query({
  args: {
    action: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const admin = await getProfile(ctx);
    if (!admin || admin.role !== "admin") throw new Error("Admin only");

    const logs = await ctx.db.query("auditLogs").collect();
    const users = await ctx.db.query("users").collect();
    const profiles = await ctx.db.query("profiles").collect();

    const filtered = logs
      .filter((l) => !args.action || l.action.startsWith(args.action))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, args.limit ?? 200);

    return filtered.map((l) => {
      const profile = profiles.find((p) => p.userId === l.userId);
      const user = users.find((u) => u._id === l.userId);
      return {
        _id: l._id,
        actor: profile?.fullName ?? user?.name ?? user?.email ?? "System",
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        oldValue: l.oldValue,
        newValue: l.newValue,
        createdAt: l.createdAt,
      };
    });
  },
  returns: v.any(),
});
