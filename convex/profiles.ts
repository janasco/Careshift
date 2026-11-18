import { createAccount, getAuthUserId, modifyAccountCredentials } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

// ── internal helpers ──────────────────────────────────────────────────────

export async function getProfile(ctx: any): Promise<any | null> {
  const userId: Id<"users"> | null = await getAuthUserId(ctx);
  if (!userId) return null;
  const profiles = await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .collect();
  return profiles[0] ?? null;
}

export async function logAudit(ctx: any, profileId: any, action: string, entityType: string, entityId?: string, oldValue?: string, newValue?: string) {
  await ctx.db.insert("auditLogs", {
    userId: profileId ? (await ctx.db.get(profileId))?.userId : undefined,
    action,
    entityType,
    entityId,
    oldValue,
    newValue,
    createdAt: Date.now(),
  });
}

// ── queries ───────────────────────────────────────────────────────────────

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    const profile = await getProfile(ctx);
    if (!profile) return { user: { name: user?.name, email: user?.email }, profile: null };
    return {
      user: { name: user?.name, email: user?.email },
      profile: {
        _id: profile._id,
        role: profile.role,
        fullName: profile.fullName,
        shiftId: profile.shiftId,
        active: profile.active,
        lastLoginAt: profile.lastLoginAt,
      },
    };
  },
  returns: v.any(),
});

export const touchLastLogin = mutation({
  args: {},
  handler: async (ctx) => {
    const profile = await getProfile(ctx);
    if (!profile) return;
    await ctx.db.patch(profile._id, { lastLoginAt: Date.now() });
  },
});

export const listProfiles = query({
  args: {},
  handler: async (ctx) => {
    const admin = await getProfile(ctx);
    if (!admin || admin.role !== "admin") throw new Error("Admin only");
    return await ctx.db.query("profiles").collect();
  },
  returns: v.any(),
});

export const createProfile = mutation({
  args: {
    email: v.string(),
    fullName: v.string(),
    phone: v.optional(v.string()),
    employeeCode: v.optional(v.string()),
    shiftId: v.optional(v.id("shifts")),
    role: v.union(v.literal("admin"), v.literal("caregiver")),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await getProfile(ctx);
    if (!admin || admin.role !== "admin") throw new Error("Admin only");

    if (args.password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    // Ensure email isn't already used
    const email = args.email.trim().toLowerCase();
    const existingUsers = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .collect();
    if (existingUsers.length > 0) throw new Error("A user with this email already exists");

    // Create the auth user + password account via Convex Auth (Lucia Scrypt
    // hashing) so the caregiver can sign in with email + password. The helper
    // is declared for action contexts but only uses ctx.runMutation internally.
    const authCtx = ctx as unknown as Parameters<typeof createAccount>[0];
    const created = (await createAccount(authCtx, {
      provider: "password",
      account: { id: email, secret: args.password },
      profile: { email, name: args.fullName },
    })) as { user: { _id: any } };
    const userId = created.user._id;

    const profileId = await ctx.db.insert("profiles", {
      userId,
      role: args.role,
      fullName: args.fullName,
      phone: args.phone,
      employeeCode: args.employeeCode,
      shiftId: args.shiftId,
      active: true,
    });

    // Derive an employee code when none was provided.
    if (!args.employeeCode && args.role === "caregiver") {
      const count = (await ctx.db.query("caregivers").collect()).length + 1;
      await ctx.db.patch(profileId, { employeeCode: `CG-${String(count).padStart(3, "0")}` });
    }

    if (args.role === "caregiver") {
      const code = args.employeeCode ?? `CG-${String((await ctx.db.query("caregivers").collect()).length + 1).padStart(3, "0")}`;
      await ctx.db.insert("caregivers", {
        userId,
        shiftId: args.shiftId,
        phone: args.phone,
        employeeCode: code,
        status: "active",
        hiredAt: Date.now(),
      });
    }

    await logAudit(ctx, admin._id, "caregiver.account_created", "profile", profileId, undefined, args.fullName);
    return profileId;
  },
  returns: v.any(),
});

export const updateProfile = mutation({
  args: {
    profileId: v.id("profiles"),
    fullName: v.optional(v.string()),
    phone: v.optional(v.string()),
    employeeCode: v.optional(v.string()),
    shiftId: v.optional(v.id("shifts")),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const admin = await getProfile(ctx);
    if (!admin || admin.role !== "admin") throw new Error("Admin only");

    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("Profile not found");

    const patch: any = {};
    if (args.fullName !== undefined) patch.fullName = args.fullName;
    if (args.phone !== undefined) patch.phone = args.phone;
    if (args.employeeCode !== undefined) patch.employeeCode = args.employeeCode;
    if (args.shiftId !== undefined) patch.shiftId = args.shiftId;
    if (args.active !== undefined) patch.active = args.active;

    await ctx.db.patch(args.profileId, patch);

    // Mirror to caregivers table
    const cg = await ctx.db
      .query("caregivers")
      .withIndex("by_userId", (q) => q.eq("userId", profile.userId))
      .collect();
    if (cg[0]) {
      await ctx.db.patch(cg[0]._id, {
        shiftId: args.shiftId ?? cg[0].shiftId,
        phone: args.phone ?? cg[0].phone,
        employeeCode: args.employeeCode ?? cg[0].employeeCode,
        status: args.active === false ? "inactive" : "active",
      });
    }

    await logAudit(ctx, admin._id, "caregiver.updated", "profile", args.profileId, JSON.stringify({ name: profile.fullName, active: profile.active }), JSON.stringify(patch));
  },
  returns: v.null(),
});

export const resetPassword = mutation({
  args: { profileId: v.id("profiles"), newPassword: v.string() },
  handler: async (ctx, args) => {
    const admin = await getProfile(ctx);
    if (!admin || admin.role !== "admin") throw new Error("Admin only");
    if (args.newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("Profile not found");
    const user = await ctx.db.get(profile.userId);
    if (!user?.email) throw new Error("Account has no email — cannot reset password");

    const authCtx = ctx as unknown as Parameters<typeof modifyAccountCredentials>[0];
    await modifyAccountCredentials(authCtx, {
      provider: "password",
      account: { id: user.email.trim().toLowerCase(), secret: args.newPassword },
    });

    await logAudit(ctx, admin._id, "caregiver.password_reset", "profile", args.profileId, undefined, "(redacted)");
  },
  returns: v.null(),
});
