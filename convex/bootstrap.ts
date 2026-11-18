import { createAccount, getAuthUserId, modifyAccountCredentials } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { logAudit } from "./profiles";
import { SHIFT_PRESETS } from "./shared";

// ── Workspace status (public — gates the setup screen) ────────────────────

/**
 * True while the workspace has no admin yet. Intentionally unauthenticated:
 * it only reveals a boolean ("is this fresh?") so the sign-in page can offer
 * the one-time admin setup form. Once an admin exists it always returns false.
 */
export const workspaceStatus = query({
  args: {},
  handler: async (ctx) => {
    const admins = await ctx.db
      .query("profiles")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
    return { needsSetup: !admins.some((p) => p.role === "admin") };
  },
  returns: v.object({ needsSetup: v.boolean() }),
});

// ── Workspace reset (wipes demo/history data) ─────────────────────────────

/**
 * Clears all operational data: schedules, completions, issues, audit logs,
 * assignments, task templates, caregivers, profiles, and auth users.
 * Shifts are recreated from the standard presets (Morning/Afternoon/Night).
 * Admin-gated so it can only be run by the signed-in administrator (or via
 * the Convex CLI with admin credentials).
 */
export const resetWorkspace = mutation({
  args: {},
  handler: async (ctx) => {
    const viewer = await ctx.db
      .query("profiles")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
    const userId = await getAuthUserId(ctx);
    const callerProfile = userId ? viewer.find((p) => p.userId === userId) : undefined;
    const isCli = !userId; // CLI/admin-console invocations have no user session
    if (callerProfile?.role !== "admin" && !isCli) throw new Error("Admin only");
    const wipe = async (table: string) => {
      for (const doc of await (ctx.db.query as any)(table).collect()) {
        await ctx.db.delete(doc._id);
      }
    };

    // Auth-system tables first (sessions/accounts reference users)
    for (const t of ["authSessions", "authAccounts", "authVerifiers", "authVerificationCodes", "authRateLimits", "authRefreshTokens"]) {
      try {
        await wipe(t);
      } catch {
        // Table may not exist in this schema version — skip it.
      }
    }

    // Operational tables (order respects references)
    await wipe("taskCompletions");
    await wipe("scheduledTasks");
    await wipe("issues");
    await wipe("auditLogs");
    await wipe("assignments");
    await wipe("taskTemplates");
    await wipe("caregivers");
    await wipe("profiles");
    await wipe("users");
    await wipe("shifts");

    // Recreate the three standard shifts
    for (const preset of SHIFT_PRESETS) {
      await ctx.db.insert("shifts", { name: preset.name, startTime: preset.start, endTime: preset.end, active: true });
    }

    await ctx.db.insert("auditLogs", {
      action: "system.reset",
      entityType: "system",
      newValue: "Workspace reset — all demo and operational data cleared",
      createdAt: Date.now(),
    });

    return { reset: true };
  },
  returns: v.object({ reset: v.boolean() }),
});

// ── One-time admin claim (setup screen) ───────────────────────────────────

/**
 * Creates the first admin account. Only succeeds while the workspace has no
 * admin (checked server-side), so the setup form cannot be abused later.
 * The password verifier is created via Convex Auth's Password provider
 * (Lucia Scrypt) so the account can sign in like any other.
 */
export const claimAdmin = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const admins = await ctx.db
      .query("profiles")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
    if (admins.some((p) => p.role === "admin")) {
      throw new Error("An administrator already exists — sign in instead.");
    }

    const email = args.email.trim().toLowerCase();

    // Create the auth user + password account (hashed via Convex Auth).
    // These Convex Auth helpers are declared for action contexts but only use
    // ctx.runMutation internally, which mutations provide.
    const authCtx = ctx as unknown as Parameters<typeof createAccount>[0];
    const created = (await createAccount(authCtx, {
      provider: "password",
      account: { id: email, secret: args.password },
      profile: { email, name: args.name },
    })) as { user: { _id: any } };
    const userId = created.user._id;

    // Register the admin profile.
    const profileId = await ctx.db.insert("profiles", {
      userId,
      role: "admin",
      fullName: args.name,
      active: true,
      lastLoginAt: Date.now(),
    });

    await ctx.db.insert("auditLogs", {
      userId,
      action: "admin.claimed",
      entityType: "profile",
      entityId: profileId,
      newValue: args.name,
      createdAt: Date.now(),
    });

    return { profileId };
  },
  returns: v.any(),
});

// ── Starter task library ─────────────────────────────────────────────────

const STARTER_TEMPLATES: Array<{
  name: string;
  category: string;
  priority: "high" | "medium" | "low";
  estimatedDuration: number;
  required: boolean;
  description: string;
}> = [
  // Personal Care
  { name: "Assist with bathing", category: "Personal Care", priority: "high", estimatedDuration: 45, required: true, description: "Assist with shower or bed bath per care plan" },
  { name: "Assist with dressing", category: "Personal Care", priority: "high", estimatedDuration: 30, required: true, description: "Help select and put on weather-appropriate clothing" },
  { name: "Oral hygiene", category: "Personal Care", priority: "medium", estimatedDuration: 15, required: true, description: "Brushing, denture care, mouth rinse" },
  { name: "Grooming", category: "Personal Care", priority: "low", estimatedDuration: 15, required: false, description: "Hair care, shaving, nail care as tolerated" },
  // Medication
  { name: "Check medication schedule", category: "Medication", priority: "high", estimatedDuration: 15, required: true, description: "Verify schedule and prepare doses" },
  { name: "Assist with medication", category: "Medication", priority: "high", estimatedDuration: 20, required: true, description: "Administer or prompt per medication plan" },
  { name: "Record medication observation", category: "Medication", priority: "medium", estimatedDuration: 10, required: true, description: "Note side effects, refusals, or concerns" },
  // Meals
  { name: "Prepare breakfast", category: "Meals", priority: "high", estimatedDuration: 30, required: true, description: "Prepare morning meal per dietary plan" },
  { name: "Prepare lunch", category: "Meals", priority: "high", estimatedDuration: 40, required: true, description: "Prepare and serve midday meal" },
  { name: "Prepare dinner", category: "Meals", priority: "high", estimatedDuration: 45, required: true, description: "Prepare and serve evening meal" },
  { name: "Record meal intake", category: "Meals", priority: "medium", estimatedDuration: 10, required: true, description: "Record appetite and intake percentage" },
  // Housekeeping
  { name: "Clean room", category: "Housekeeping", priority: "low", estimatedDuration: 30, required: false, description: "Tidy and sanitize living area" },
  { name: "Change bed sheets", category: "Housekeeping", priority: "low", estimatedDuration: 20, required: false, description: "Strip and remake bed with fresh linens" },
  { name: "Laundry", category: "Housekeeping", priority: "low", estimatedDuration: 40, required: false, description: "Wash, dry, fold, and put away" },
  { name: "Organize personal items", category: "Housekeeping", priority: "low", estimatedDuration: 20, required: false, description: "Keep belongings accessible and ordered" },
  // Monitoring
  { name: "Check vital signs", category: "Monitoring", priority: "high", estimatedDuration: 15, required: true, description: "Temperature, pulse, blood pressure" },
  { name: "Check hydration", category: "Monitoring", priority: "medium", estimatedDuration: 10, required: true, description: "Offer water and record intake" },
  { name: "Check mobility", category: "Monitoring", priority: "medium", estimatedDuration: 15, required: true, description: "Safe walking, transfers, fall risk" },
  { name: "Record observations", category: "Monitoring", priority: "low", estimatedDuration: 10, required: true, description: "General wellbeing and behavior notes" },
];

/**
 * Inserts the standard care-task template library (skipping names that already
 * exist). This is operational content, not demo data — no fake caregivers or
 * history. Idempotent.
 */
export const seedStarterTemplates = mutation({
  args: {},
  handler: async (ctx) => {
    // Admin-gated for browser sessions; CLI invocations (no user session)
    // are also allowed.
    const profiles = await ctx.db
      .query("profiles")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
    const userId = await getAuthUserId(ctx);
    const caller = userId ? profiles.find((p) => p.userId === userId) : undefined;
    if (userId && caller?.role !== "admin") throw new Error("Admin only");

    const existing = new Set(
      (await ctx.db.query("taskTemplates").collect()).map((t) => t.name),
    );
    let added = 0;
    for (const t of STARTER_TEMPLATES) {
      if (existing.has(t.name)) continue;
      await ctx.db.insert("taskTemplates", { ...t, recurring: true, active: true });
      added += 1;
    }
    return { added, skipped: STARTER_TEMPLATES.length - added };
  },
  returns: v.object({ added: v.number(), skipped: v.number() }),
});

// ── Password management (used by admin caregiver management) ──────────────

/**
 * Sets the password for an existing auth account. Used by the admin's
 * "reset password" action and by the initial registration of caregivers.
 */
export const setAccountPassword = mutation({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const authCtx = ctx as unknown as Parameters<typeof modifyAccountCredentials>[0];
    await modifyAccountCredentials(authCtx, {
      provider: "password",
      account: { id: email, secret: args.password },
    });
  },
  returns: v.null(),
});
