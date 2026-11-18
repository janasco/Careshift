import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getProfile } from "./profiles";
import type { Id } from "./_generated/dataModel";

async function requireAdmin(ctx: any) {
  const profile = await getProfile(ctx);
  if (!profile || profile.role !== "admin") throw new Error("Admin only");
}

async function patientNameFor(ctx: any, patientId?: Id<"patients">) {
  if (!patientId) return undefined;
  const patient = await ctx.db.get(patientId);
  return patient?.fullName;
}

async function caregiverNameFor(ctx: any, caregiverId?: Id<"caregivers">) {
  if (!caregiverId) return undefined;
  const caregiver = await ctx.db.get(caregiverId);
  if (!caregiver) return undefined;
  const profiles = await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q: any) => q.eq("userId", caregiver.userId))
    .collect();
  return profiles[0]?.fullName;
}

function normalizeTimes(times: string[]) {
  return Array.from(
    new Set(
      times
        .map((time) => time.trim())
        .filter((time) => /^\d{1,2}:\d{2}$/.test(time))
        .map((time) => {
          const [hours, minutes] = time.split(":");
          return `${String(Number(hours)).padStart(2, "0")}:${minutes}`;
        }),
    ),
  ).sort();
}

function eachDate(fromDate: string, toDate: string) {
  const dates: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    return dates;
  }
  const cursor = new Date(`${fromDate}T00:00:00`);
  const end = new Date(`${toDate}T00:00:00`);
  while (cursor <= end && dates.length < 370) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, "0");
    const day = String(cursor.getDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${day}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export const listMedications = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const medications = await ctx.db.query("medications").collect();
    const patients = await ctx.db.query("patients").collect();
    return medications
      .map((medication) => ({
        ...medication,
        patientName:
          patients.find((patient) => patient._id === medication.patientId)?.fullName ??
          medication.patientName ??
          "Unspecified",
        lowStock:
          medication.active &&
          medication.stock != null &&
          medication.refillThreshold != null &&
          medication.stock <= medication.refillThreshold,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
  returns: v.any(),
});

export const createMedication = mutation({
  args: {
    patientId: v.optional(v.id("patients")),
    name: v.string(),
    dosage: v.optional(v.string()),
    route: v.optional(v.string()),
    frequency: v.optional(v.string()),
    times: v.array(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    instructions: v.optional(v.string()),
    stock: v.optional(v.number()),
    refillThreshold: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (!args.name.trim()) throw new Error("Medication name is required");
    return await ctx.db.insert("medications", {
      patientId: args.patientId,
      patientName: await patientNameFor(ctx, args.patientId),
      name: args.name.trim(),
      dosage: args.dosage?.trim() || undefined,
      route: args.route?.trim() || undefined,
      frequency: args.frequency?.trim() || undefined,
      times: normalizeTimes(args.times),
      startDate: args.startDate?.trim() || undefined,
      endDate: args.endDate?.trim() || undefined,
      instructions: args.instructions?.trim() || undefined,
      stock: args.stock,
      refillThreshold: args.refillThreshold,
      active: true,
      createdAt: Date.now(),
    });
  },
  returns: v.id("medications"),
});

export const updateMedication = mutation({
  args: {
    medicationId: v.id("medications"),
    patientId: v.optional(v.id("patients")),
    name: v.optional(v.string()),
    dosage: v.optional(v.string()),
    route: v.optional(v.string()),
    frequency: v.optional(v.string()),
    times: v.optional(v.array(v.string())),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    instructions: v.optional(v.string()),
    stock: v.optional(v.number()),
    refillThreshold: v.optional(v.number()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const medication = await ctx.db.get(args.medicationId);
    if (!medication) throw new Error("Medication not found");

    await ctx.db.patch(args.medicationId, {
      ...(args.patientId !== undefined
        ? {
            patientId: args.patientId,
            patientName: await patientNameFor(ctx, args.patientId),
          }
        : {}),
      ...(args.name !== undefined ? { name: args.name.trim() } : {}),
      ...(args.dosage !== undefined ? { dosage: args.dosage.trim() || undefined } : {}),
      ...(args.route !== undefined ? { route: args.route.trim() || undefined } : {}),
      ...(args.frequency !== undefined
        ? { frequency: args.frequency.trim() || undefined }
        : {}),
      ...(args.times !== undefined ? { times: normalizeTimes(args.times) } : {}),
      ...(args.startDate !== undefined
        ? { startDate: args.startDate.trim() || undefined }
        : {}),
      ...(args.endDate !== undefined
        ? { endDate: args.endDate.trim() || undefined }
        : {}),
      ...(args.instructions !== undefined
        ? { instructions: args.instructions.trim() || undefined }
        : {}),
      ...(args.stock !== undefined ? { stock: args.stock } : {}),
      ...(args.refillThreshold !== undefined
        ? { refillThreshold: args.refillThreshold }
        : {}),
      ...(args.active !== undefined ? { active: args.active } : {}),
    });
    return null;
  },
  returns: v.null(),
});

export const listMedicationDoses = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const medications = (await ctx.db.query("medications").collect())
      .filter((medication) => medication.active)
      .filter(
        (medication) =>
          (!medication.startDate || args.date >= medication.startDate) &&
          (!medication.endDate || args.date <= medication.endDate),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
    const logs = await ctx.db
      .query("medicationLogs")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();
    const patients = await ctx.db.query("patients").collect();

    return medications.map((medication) => {
      const patientName =
        patients.find((patient) => patient._id === medication.patientId)?.fullName ??
        medication.patientName ??
        "Unspecified";
      return {
        ...medication,
        patientName,
        lowStock:
          medication.stock != null &&
          medication.refillThreshold != null &&
          medication.stock <= medication.refillThreshold,
        doses: medication.times.map((time) => {
          const log = logs.find(
            (row) =>
              row.medicationId === medication._id &&
              row.scheduledTime === time,
          );
          return { time, log: log ?? null };
        }),
      };
    });
  },
  returns: v.any(),
});

export const logDose = mutation({
  args: {
    medicationId: v.id("medications"),
    date: v.string(),
    scheduledTime: v.string(),
    status: v.union(v.literal("taken"), v.literal("skipped"), v.literal("missed")),
    skipReason: v.optional(v.string()),
    notes: v.optional(v.string()),
    caregiverId: v.optional(v.id("caregivers")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const medication = await ctx.db.get(args.medicationId);
    if (!medication) throw new Error("Medication not found");

    const existingLogs = await ctx.db
      .query("medicationLogs")
      .withIndex("by_medication_date", (q) =>
        q.eq("medicationId", args.medicationId).eq("date", args.date),
      )
      .collect();
    const existing = existingLogs.find(
      (row) => row.scheduledTime === args.scheduledTime,
    );

    let stockDelta = 0;
    if (existing?.status === "taken" && args.status !== "taken") stockDelta += 1;
    if (existing?.status !== "taken" && args.status === "taken") stockDelta -= 1;

    if (medication.stock != null && stockDelta !== 0) {
      await ctx.db.patch(medication._id, {
        stock: Math.max(0, medication.stock + stockDelta),
      });
    }

    const caregiverName = await caregiverNameFor(ctx, args.caregiverId);
    const payload = {
      patientId: medication.patientId,
      caregiverId: args.caregiverId,
      caregiverName,
      status: args.status,
      takenAt: args.status === "taken" ? Date.now() : undefined,
      skipReason:
        args.status === "skipped"
          ? args.skipReason?.trim() || "Not specified"
          : undefined,
      notes: args.notes?.trim() || undefined,
      createdAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }
    return await ctx.db.insert("medicationLogs", {
      medicationId: args.medicationId,
      date: args.date,
      scheduledTime: args.scheduledTime,
      ...payload,
    });
  },
  returns: v.id("medicationLogs"),
});

export const clearDoseLog = mutation({
  args: {
    medicationId: v.id("medications"),
    date: v.string(),
    scheduledTime: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const medication = await ctx.db.get(args.medicationId);
    const logs = await ctx.db
      .query("medicationLogs")
      .withIndex("by_medication_date", (q) =>
        q.eq("medicationId", args.medicationId).eq("date", args.date),
      )
      .collect();
    const existing = logs.find((row) => row.scheduledTime === args.scheduledTime);
    if (!existing) return null;

    if (existing.status === "taken" && medication?.stock != null) {
      await ctx.db.patch(medication._id, { stock: medication.stock + 1 });
    }
    await ctx.db.delete(existing._id);
    return null;
  },
  returns: v.null(),
});

export const medicationAdherence = query({
  args: {
    fromDate: v.string(),
    toDate: v.string(),
    nowDate: v.string(),
    nowTime: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const dates = eachDate(args.fromDate, args.toDate);
    const medications = (await ctx.db.query("medications").collect()).filter(
      (medication) => medication.active,
    );
    const logs = await ctx.db.query("medicationLogs").collect();
    const patients = await ctx.db.query("patients").collect();

    const rows = medications.map((medication) => {
      let expected = 0;
      let taken = 0;
      let skipped = 0;
      let missed = 0;

      for (const date of dates) {
        if (medication.startDate && date < medication.startDate) continue;
        if (medication.endDate && date > medication.endDate) continue;
        for (const time of medication.times) {
          if (date > args.nowDate) continue;
          if (date === args.nowDate && time > args.nowTime) continue;
          expected += 1;
          const log = logs.find(
            (row) =>
              row.medicationId === medication._id &&
              row.date === date &&
              row.scheduledTime === time,
          );
          if (log?.status === "taken") taken += 1;
          else if (log?.status === "skipped") skipped += 1;
          else missed += 1;
        }
      }

      return {
        medicationId: medication._id,
        name: medication.name,
        patientName:
          patients.find((patient) => patient._id === medication.patientId)?.fullName ??
          medication.patientName ??
          "Unspecified",
        expected,
        taken,
        skipped,
        missed,
        rate: expected > 0 ? Math.round((taken / expected) * 100) : 0,
        stock: medication.stock,
        refillThreshold: medication.refillThreshold,
        lowStock:
          medication.stock != null &&
          medication.refillThreshold != null &&
          medication.stock <= medication.refillThreshold,
      };
    });

    const totals = rows.reduce(
      (sum, row) => ({
        expected: sum.expected + row.expected,
        taken: sum.taken + row.taken,
        skipped: sum.skipped + row.skipped,
        missed: sum.missed + row.missed,
      }),
      { expected: 0, taken: 0, skipped: 0, missed: 0 },
    );

    return {
      ...totals,
      rate: totals.expected > 0 ? Math.round((totals.taken / totals.expected) * 100) : 0,
      medications: rows,
    };
  },
  returns: v.any(),
});
