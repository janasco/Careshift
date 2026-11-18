import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getProfile } from "./profiles";
import type { Id } from "./_generated/dataModel";

async function requireAdmin(ctx: any) {
  const profile = await getProfile(ctx);
  if (!profile || profile.role !== "admin") throw new Error("Admin only");
}

async function requireCaregiver(ctx: any) {
  const profile = await getProfile(ctx);
  if (!profile || profile.role !== "caregiver") throw new Error("Caregiver only");
  const caregivers = await ctx.db
    .query("caregivers")
    .withIndex("by_userId", (q: any) => q.eq("userId", profile.userId))
    .collect();
  const caregiver = caregivers[0];
  if (!caregiver) throw new Error("Caregiver record not found");
  return { profile, caregiver };
}

function assertDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid date");
}

export const myVisitForDate = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const { caregiver } = await requireCaregiver(ctx);
    assertDate(args.date);
    const allVisits = await ctx.db
      .query("visits")
      .withIndex("by_caregiverId", (q) => q.eq("caregiverId", caregiver._id))
      .collect();
    const active = allVisits.find((visit) => visit.status === "active");
    if (active) return active;
    const visits = allVisits
      .filter((visit) => visit.date === args.date)
      .sort((a, b) => b.clockInAt - a.clockInAt);
    return visits[0] ?? null;
  },
  returns: v.any(),
});

export const clockIn = mutation({
  args: {
    date: v.string(),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    accuracy: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { profile, caregiver } = await requireCaregiver(ctx);
    assertDate(args.date);

    const allVisits = await ctx.db
      .query("visits")
      .withIndex("by_caregiverId", (q) => q.eq("caregiverId", caregiver._id))
      .collect();
    if (allVisits.some((visit) => visit.status === "active")) {
      throw new Error("You are already clocked in. Clock out before starting a new visit.");
    }

    return await ctx.db.insert("visits", {
      caregiverId: caregiver._id,
      caregiverName: profile.fullName,
      shiftId: caregiver.shiftId,
      date: args.date,
      clockInAt: Date.now(),
      clockInLat: args.lat,
      clockInLng: args.lng,
      clockInAccuracy: args.accuracy,
      clockInNotes: args.notes?.trim() || undefined,
      status: "active",
      createdAt: Date.now(),
    });
  },
  returns: v.id("visits"),
});

export const clockOut = mutation({
  args: {
    visitId: v.optional(v.id("visits")),
    date: v.string(),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    accuracy: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { caregiver } = await requireCaregiver(ctx);
    assertDate(args.date);

    let visit = null;
    if (args.visitId) {
      visit = await ctx.db.get(args.visitId);
      if (!visit || visit.caregiverId !== caregiver._id) {
        throw new Error("Visit not found");
      }
    } else {
      const visits = await ctx.db
        .query("visits")
        .withIndex("by_caregiverId", (q) => q.eq("caregiverId", caregiver._id))
        .collect();
      visit = visits.find((row) => row.status === "active") ?? null;
    }
    if (!visit) throw new Error("No active visit to clock out from");
    if (visit.status === "completed") throw new Error("This visit is already completed");

    const tasks = await ctx.db
      .query("scheduledTasks")
      .withIndex("by_caregiverId_date", (q) =>
        q.eq("caregiverId", caregiver._id).eq("date", visit.date),
      )
      .collect();
    const pending = tasks.filter((task) => task.status === "pending");
    if (pending.length > 0) {
      throw new Error(
        `Cannot clock out: ${pending.length} task${pending.length === 1 ? "" : "s"} still pending. Complete them or report an issue first.`,
      );
    }

    const clockOutAt = Date.now();
    await ctx.db.patch(visit._id, {
      clockOutAt,
      clockOutLat: args.lat,
      clockOutLng: args.lng,
      clockOutAccuracy: args.accuracy,
      clockOutNotes: args.notes?.trim() || undefined,
      status: "completed",
    });

    return { durationMs: clockOutAt - visit.clockInAt };
  },
  returns: v.object({ durationMs: v.number() }),
});

export const listVisits = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    assertDate(args.date);
    const visits = await ctx.db
      .query("visits")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();
    const caregivers = await ctx.db.query("caregivers").collect();
    const profiles = await ctx.db.query("profiles").collect();
    const shifts = await ctx.db.query("shifts").collect();

    return visits
      .map((visit) => {
        const caregiver = caregivers.find((row) => row._id === visit.caregiverId);
        const profile = caregiver
          ? profiles.find((row) => row.userId === caregiver.userId)
          : undefined;
        const shift = shifts.find((row) => row._id === visit.shiftId);
        return {
          ...visit,
          caregiverName: profile?.fullName ?? visit.caregiverName ?? "Caregiver",
          shiftName: shift?.name ?? "—",
          durationMs: (visit.clockOutAt ?? Date.now()) - visit.clockInAt,
          hasClockInGps: visit.clockInLat != null && visit.clockInLng != null,
          hasClockOutGps: visit.clockOutLat != null && visit.clockOutLng != null,
        };
      })
      .sort((a, b) => b.clockInAt - a.clockInAt);
  },
  returns: v.any(),
});

export const getVisit = query({
  args: { visitId: v.id("visits") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.get(args.visitId);
  },
  returns: v.any(),
});
