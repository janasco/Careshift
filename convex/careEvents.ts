import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getProfile } from "./profiles";
import type { Id } from "./_generated/dataModel";

async function requireAdmin(ctx: any) {
  const profile = await getProfile(ctx);
  if (!profile || profile.role !== "admin") throw new Error("Admin only");
}

async function resolveNames(ctx: any, patientId?: Id<"patients">, caregiverId?: Id<"caregivers">) {
  let patientName: string | undefined;
  let caregiverName: string | undefined;

  if (patientId) {
    const patient = await ctx.db.get(patientId);
    patientName = patient?.fullName;
  }
  if (caregiverId) {
    const caregiver = await ctx.db.get(caregiverId);
    if (caregiver) {
      const profiles = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q: any) => q.eq("userId", caregiver.userId))
        .collect();
      caregiverName = profiles[0]?.fullName;
    }
  }
  return { patientName, caregiverName };
}

export const listCareEvents = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const events = await ctx.db
      .query("careEvents")
      .withIndex("by_createdAt")
      .order("desc")
      .collect();
    const patients = await ctx.db.query("patients").collect();
    const caregivers = await ctx.db.query("caregivers").collect();
    const profiles = await ctx.db.query("profiles").collect();

    return events.map((event) => {
      const patient = patients.find((row) => row._id === event.patientId);
      const caregiver = caregivers.find((row) => row._id === event.caregiverId);
      const profile = caregiver
        ? profiles.find((row) => row.userId === caregiver.userId)
        : undefined;
      return {
        ...event,
        patientName: patient?.fullName ?? event.patientName ?? "Unspecified",
        caregiverName: profile?.fullName ?? event.caregiverName ?? "Unassigned",
      };
    });
  },
  returns: v.any(),
});

export const createCareEvent = mutation({
  args: {
    patientId: v.optional(v.id("patients")),
    caregiverId: v.optional(v.id("caregivers")),
    eventType: v.string(),
    severity: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    occurredAt: v.optional(v.number()),
    timeLabel: v.optional(v.string()),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const eventType = args.eventType.trim();
    const notes = args.notes.trim();
    if (!eventType) throw new Error("Event type is required");
    if (!notes) throw new Error("Notes are required");

    const names = await resolveNames(ctx, args.patientId, args.caregiverId);
    return await ctx.db.insert("careEvents", {
      patientId: args.patientId,
      patientName: names.patientName,
      caregiverId: args.caregiverId,
      caregiverName: names.caregiverName,
      eventType,
      severity: args.severity,
      occurredAt: args.occurredAt,
      timeLabel: args.timeLabel?.trim() || undefined,
      notes,
      source: "manual",
      createdAt: Date.now(),
    });
  },
  returns: v.id("careEvents"),
});

export const updateCareEvent = mutation({
  args: {
    eventId: v.id("careEvents"),
    patientId: v.optional(v.id("patients")),
    caregiverId: v.optional(v.id("caregivers")),
    eventType: v.optional(v.string()),
    severity: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    occurredAt: v.optional(v.number()),
    timeLabel: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Care event not found");

    const names = await resolveNames(
      ctx,
      args.patientId !== undefined ? args.patientId : event.patientId,
      args.caregiverId !== undefined ? args.caregiverId : event.caregiverId,
    );

    await ctx.db.patch(args.eventId, {
      ...(args.patientId !== undefined
        ? { patientId: args.patientId, patientName: names.patientName }
        : {}),
      ...(args.caregiverId !== undefined
        ? { caregiverId: args.caregiverId, caregiverName: names.caregiverName }
        : {}),
      ...(args.eventType !== undefined ? { eventType: args.eventType.trim() } : {}),
      ...(args.severity !== undefined ? { severity: args.severity } : {}),
      ...(args.occurredAt !== undefined ? { occurredAt: args.occurredAt } : {}),
      ...(args.timeLabel !== undefined
        ? { timeLabel: args.timeLabel.trim() || undefined }
        : {}),
      ...(args.notes !== undefined ? { notes: args.notes.trim() } : {}),
    });
    return null;
  },
  returns: v.null(),
});
