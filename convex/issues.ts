import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getProfile, logAudit } from "./profiles";

export const resolveIssue = mutation({
  args: { issueId: v.id("issues"), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const admin = await getProfile(ctx);
    if (!admin || admin.role !== "admin") throw new Error("Admin only");
    const issue = await ctx.db.get(args.issueId);
    if (!issue) throw new Error("Issue not found");
    if (issue.status === "resolved") return;
    await ctx.db.patch(args.issueId, {
      status: "resolved",
      resolvedAt: Date.now(),
      resolvedByUserId: admin.userId,
    });
    await logAudit(ctx, admin.userId, "issue.resolved", "issue", args.issueId, JSON.stringify({ status: "open" }), JSON.stringify({ status: "resolved", note: args.note }));
  },
  returns: v.null(),
});
