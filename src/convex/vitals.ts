import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getProfile } from "./profiles";
import type { Id } from "./_generated/dataModel";

// ── helpers ───────────────────────────────────────────────────────────────

async function requireAdminOrCli(ctx: any) {
  const profile = await getProfile(ctx);
  if (profile && profile.role !== "admin") throw new Error("Admin only");
}

// ── queries ───────────────────────────────────────────────────────────────

export const listVitalSigns = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminOrCli(ctx);
    const rows = await ctx.db
      .query("vitalSigns")
      .withIndex("by_createdAt")
      .order("desc")
      .collect();
    return rows.map((row) => ({
      ...row,
      caregiverName: row.caregiverName ?? "Unassigned",
      patientName: row.patientName ?? "Unspecified",
    }));
  },
  returns: v.any(),
});

// ── mutations ─────────────────────────────────────────────────────────────

export const createVitalSign = mutation({
  args: {
    patientName: v.optional(v.string()),
    caregiverId: v.optional(v.id("caregivers")),
    timeLabel: v.optional(v.string()),
    bp: v.optional(v.string()),
    spo2: v.optional(v.number()),
    pulse: v.optional(v.number()),
    respiration: v.optional(v.number()),
    temperature: v.optional(v.string()),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCli(ctx);

    let caregiverName: string | undefined;
    if (args.caregiverId) {
      const caregiver = await ctx.db.get(args.caregiverId);
      if (caregiver) {
        const profiles = await ctx.db
          .query("profiles")
          .withIndex("by_userId", (q) => q.eq("userId", caregiver.userId))
          .collect();
        caregiverName = profiles[0]?.fullName;
      }
    }

    const id = await ctx.db.insert("vitalSigns", {
      patientName: args.patientName?.trim() || undefined,
      caregiverId: args.caregiverId,
      caregiverName,
      timeLabel: args.timeLabel?.trim() || undefined,
      bp: args.bp?.trim() || undefined,
      spo2: args.spo2,
      pulse: args.pulse,
      respiration: args.respiration,
      temperature: args.temperature?.trim() || undefined,
      notes: args.notes.trim(),
      source: "manual",
      recordedAt: Date.now(),
      createdAt: Date.now(),
    });

    return id;
  },
  returns: v.id("vitalSigns"),
});

export const updateVitalSign = mutation({
  args: {
    id: v.id("vitalSigns"),
    patientName: v.optional(v.string()),
    caregiverId: v.optional(v.id("caregivers")),
    timeLabel: v.optional(v.string()),
    bp: v.optional(v.string()),
    spo2: v.optional(v.number()),
    pulse: v.optional(v.number()),
    respiration: v.optional(v.number()),
    temperature: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCli(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Vital signs record not found");

    let caregiverName: string | undefined;
    if (args.caregiverId) {
      const caregiver = await ctx.db.get(args.caregiverId);
      if (caregiver) {
        const profiles = await ctx.db
          .query("profiles")
          .withIndex("by_userId", (q) => q.eq("userId", caregiver.userId))
          .collect();
        caregiverName = profiles[0]?.fullName;
      }
    }

    await ctx.db.patch(args.id, {
      patientName: args.patientName?.trim() || undefined,
      caregiverId: args.caregiverId,
      caregiverName,
      timeLabel: args.timeLabel?.trim() || undefined,
      bp: args.bp?.trim() || undefined,
      spo2: args.spo2,
      pulse: args.pulse,
      respiration: args.respiration,
      temperature: args.temperature?.trim() || undefined,
      ...(args.notes !== undefined ? { notes: args.notes.trim() } : {}),
    });

    return null;
  },
  returns: v.null(),
});
