import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getProfile } from "./profiles";

async function requireAdmin(ctx: any) {
  const profile = await getProfile(ctx);
  if (!profile || profile.role !== "admin") throw new Error("Admin only");
}

function normalizeAliases(aliases?: string[]) {
  if (!aliases) return undefined;
  const cleaned = Array.from(
    new Set(aliases.map((alias) => alias.trim()).filter(Boolean)),
  );
  return cleaned.length > 0 ? cleaned : undefined;
}

export const listPatients = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const patients = await ctx.db.query("patients").collect();
    return patients.sort((a, b) => a.fullName.localeCompare(b.fullName));
  },
  returns: v.any(),
});

export const patientSummaries = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const patients = await ctx.db.query("patients").collect();
    const vitals = await ctx.db.query("vitalSigns").collect();
    const events = await ctx.db.query("careEvents").collect();

    return patients
      .map((patient) => {
        const patientVitals = vitals
          .filter((row) => row.patientId === patient._id)
          .sort((a, b) => b.createdAt - a.createdAt);
        const patientEvents = events
          .filter((row) => row.patientId === patient._id)
          .sort((a, b) => b.createdAt - a.createdAt);
        return {
          ...patient,
          vitalsCount: patientVitals.length,
          careEventCount: patientEvents.length,
          latestVitals: patientVitals[0] ?? null,
          latestEvent: patientEvents[0] ?? null,
        };
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  },
  returns: v.any(),
});

export const createPatient = mutation({
  args: {
    fullName: v.string(),
    preferredName: v.optional(v.string()),
    aliases: v.optional(v.array(v.string())),
    dateOfBirth: v.optional(v.string()),
    room: v.optional(v.string()),
    address: v.optional(v.string()),
    primaryContactName: v.optional(v.string()),
    primaryContactPhone: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const fullName = args.fullName.trim();
    if (!fullName) throw new Error("Patient name is required");
    return await ctx.db.insert("patients", {
      fullName,
      preferredName: args.preferredName?.trim() || undefined,
      aliases: normalizeAliases(args.aliases),
      dateOfBirth: args.dateOfBirth?.trim() || undefined,
      room: args.room?.trim() || undefined,
      address: args.address?.trim() || undefined,
      primaryContactName: args.primaryContactName?.trim() || undefined,
      primaryContactPhone: args.primaryContactPhone?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      status: "active",
      createdAt: Date.now(),
    });
  },
  returns: v.id("patients"),
});

export const updatePatient = mutation({
  args: {
    patientId: v.id("patients"),
    fullName: v.optional(v.string()),
    preferredName: v.optional(v.string()),
    aliases: v.optional(v.array(v.string())),
    dateOfBirth: v.optional(v.string()),
    room: v.optional(v.string()),
    address: v.optional(v.string()),
    primaryContactName: v.optional(v.string()),
    primaryContactPhone: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const patient = await ctx.db.get(args.patientId);
    if (!patient) throw new Error("Patient not found");

    await ctx.db.patch(args.patientId, {
      ...(args.fullName !== undefined ? { fullName: args.fullName.trim() } : {}),
      ...(args.preferredName !== undefined
        ? { preferredName: args.preferredName.trim() || undefined }
        : {}),
      ...(args.aliases !== undefined ? { aliases: normalizeAliases(args.aliases) } : {}),
      ...(args.dateOfBirth !== undefined
        ? { dateOfBirth: args.dateOfBirth.trim() || undefined }
        : {}),
      ...(args.room !== undefined ? { room: args.room.trim() || undefined } : {}),
      ...(args.address !== undefined
        ? { address: args.address.trim() || undefined }
        : {}),
      ...(args.primaryContactName !== undefined
        ? { primaryContactName: args.primaryContactName.trim() || undefined }
        : {}),
      ...(args.primaryContactPhone !== undefined
        ? { primaryContactPhone: args.primaryContactPhone.trim() || undefined }
        : {}),
      ...(args.notes !== undefined ? { notes: args.notes.trim() || undefined } : {}),
      ...(args.status !== undefined ? { status: args.status } : {}),
    });
    return null;
  },
  returns: v.null(),
});
