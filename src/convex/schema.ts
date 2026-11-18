import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    users: defineTable({
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      email: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),

      role: v.optional(roleValidator),
    }).index("email", ["email"]),

    // Caregiver domain tables

    profiles: defineTable({
      userId: v.id("users"),
      role: v.union(v.literal("admin"), v.literal("caregiver")),
      fullName: v.string(),
      phone: v.optional(v.string()),
      employeeCode: v.optional(v.string()),
      shiftId: v.optional(v.id("shifts")),
      active: v.boolean(),
      lastLoginAt: v.optional(v.number()),
    })
      .index("by_userId", ["userId"])
      .index("by_active", ["active"]),

    shifts: defineTable({
      name: v.string(),
      startTime: v.string(), // "HH:MM"
      endTime: v.string(), // "HH:MM"
      active: v.boolean(),
    }).index("by_active", ["active"]),

    patients: defineTable({
      fullName: v.string(),
      preferredName: v.optional(v.string()),
      dateOfBirth: v.optional(v.string()), // "YYYY-MM-DD"
      room: v.optional(v.string()),
      address: v.optional(v.string()),
      primaryContactName: v.optional(v.string()),
      primaryContactPhone: v.optional(v.string()),
      notes: v.optional(v.string()),
      status: v.union(v.literal("active"), v.literal("inactive")),
      createdAt: v.number(),
    }).index("by_status", ["status"]),

    caregivers: defineTable({
      userId: v.id("users"),
      shiftId: v.optional(v.id("shifts")),
      phone: v.optional(v.string()),
      employeeCode: v.optional(v.string()),
      status: v.union(v.literal("active"), v.literal("inactive")),
      hiredAt: v.optional(v.number()),
    })
      .index("by_userId", ["userId"])
      .index("by_status", ["status"])
      .index("by_shiftId", ["shiftId"]),

    taskTemplates: defineTable({
      name: v.string(),
      description: v.optional(v.string()),
      category: v.string(),
      priority: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
      estimatedDuration: v.number(),
      required: v.boolean(),
      recurring: v.boolean(),
      active: v.boolean(),
    }).index("by_active", ["active"]),

    assignments: defineTable({
      taskTemplateId: v.id("taskTemplates"),
      shiftId: v.id("shifts"),
      caregiverId: v.optional(v.id("caregivers")), // null = any caregiver on shift
      scheduledTime: v.string(), // "HH:MM"
      dueTime: v.string(), // "HH:MM" (may fall on the next day)
      daysOfWeek: v.array(v.number()), // 0=Sunday
      active: v.boolean(),
    })
      .index("by_shiftId", ["shiftId"])
      .index("by_caregiverId", ["caregiverId"])
      .index("by_template", ["taskTemplateId"]),

    scheduledTasks: defineTable({
      assignmentId: v.optional(v.id("assignments")),
      templateId: v.id("taskTemplates"),
      caregiverId: v.id("caregivers"),
      shiftId: v.id("shifts"),
      date: v.string(), // "YYYY-MM-DD" — the date the shift started
      scheduledTime: v.string(),
      dueMs: v.number(),
      shiftStartMs: v.number(),
      shiftEndMs: v.number(),
      status: v.union(
        v.literal("pending"),
        v.literal("completed"),
        v.literal("completed_with_issue"),
      ),
      completedAt: v.optional(v.number()),
      completedByUserId: v.optional(v.id("users")),
      note: v.optional(v.string()),
    })
      .index("by_date", ["date"])
      .index("by_caregiverId_date", ["caregiverId", "date"])
      .index("by_assignmentId_date", ["assignmentId", "date"])
      .index("by_status_date", ["status", "date"]),

    taskCompletions: defineTable({
      scheduledTaskId: v.id("scheduledTasks"),
      caregiverId: v.id("caregivers"),
      completedAt: v.number(),
      note: v.optional(v.string()),
    }).index("by_scheduledTaskId", ["scheduledTaskId"]),

    issues: defineTable({
      scheduledTaskId: v.id("scheduledTasks"),
      caregiverId: v.id("caregivers"),
      issueType: v.string(),
      description: v.string(),
      status: v.union(v.literal("open"), v.literal("resolved")),
      createdAt: v.number(),
      resolvedAt: v.optional(v.number()),
      resolvedByUserId: v.optional(v.id("users")),
    })
      .index("by_status", ["status"])
      .index("by_task", ["scheduledTaskId"])
      .index("by_caregiverId", ["caregiverId"]),

    // Manually reported vital signs and shift observations. Dates are optional
    // because some reports only include a time of day.
    vitalSigns: defineTable({
      patientId: v.optional(v.id("patients")),
      patientName: v.optional(v.string()),
      caregiverId: v.optional(v.id("caregivers")),
      caregiverName: v.optional(v.string()),
      timeLabel: v.optional(v.string()),
      bp: v.optional(v.string()),
      spo2: v.optional(v.number()),
      pulse: v.optional(v.number()),
      respiration: v.optional(v.number()),
      temperature: v.optional(v.string()),
      notes: v.string(),
      source: v.optional(v.string()),
      importKey: v.optional(v.string()),
      recordedAt: v.optional(v.number()),
      createdAt: v.number(),
    })
      .index("by_createdAt", ["createdAt"])
      .index("by_patient", ["patientName"])
      .index("by_patientId", ["patientId"])
      .index("by_caregiverId", ["caregiverId"]),

    // General care observations that are not vital signs (toileting, medication
    // given, stoma/catheter care, pain episodes, intake, etc.).
    careEvents: defineTable({
      patientId: v.optional(v.id("patients")),
      patientName: v.optional(v.string()),
      caregiverId: v.optional(v.id("caregivers")),
      caregiverName: v.optional(v.string()),
      eventType: v.string(),
      severity: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
      occurredAt: v.optional(v.number()),
      timeLabel: v.optional(v.string()),
      notes: v.string(),
      source: v.optional(v.string()),
      importKey: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_createdAt", ["createdAt"])
      .index("by_patient", ["patientId"])
      .index("by_caregiverId", ["caregiverId"])
      .index("by_type", ["eventType"]),

    // Medication schedules and per-dose administration records.
    medications: defineTable({
      patientId: v.optional(v.id("patients")),
      patientName: v.optional(v.string()),
      name: v.string(),
      dosage: v.optional(v.string()),
      route: v.optional(v.string()),
      frequency: v.optional(v.string()),
      times: v.array(v.string()), // ["08:00", "20:00"]
      startDate: v.optional(v.string()), // "YYYY-MM-DD"
      endDate: v.optional(v.string()),
      instructions: v.optional(v.string()),
      stock: v.optional(v.number()),
      refillThreshold: v.optional(v.number()),
      active: v.boolean(),
      createdAt: v.number(),
    })
      .index("by_active", ["active"])
      .index("by_patient", ["patientId"]),

    medicationLogs: defineTable({
      medicationId: v.id("medications"),
      patientId: v.optional(v.id("patients")),
      caregiverId: v.optional(v.id("caregivers")),
      caregiverName: v.optional(v.string()),
      date: v.string(), // "YYYY-MM-DD"
      scheduledTime: v.string(), // "HH:MM"
      status: v.union(v.literal("taken"), v.literal("skipped"), v.literal("missed")),
      takenAt: v.optional(v.number()),
      skipReason: v.optional(v.string()),
      notes: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_medication_date", ["medicationId", "date"])
      .index("by_date", ["date"])
      .index("by_patient", ["patientId"]),

    // Electronic visit verification: caregiver clock-in/out with optional GPS.
    visits: defineTable({
      caregiverId: v.id("caregivers"),
      caregiverName: v.optional(v.string()),
      shiftId: v.optional(v.id("shifts")),
      date: v.string(), // "YYYY-MM-DD"
      clockInAt: v.number(),
      clockInLat: v.optional(v.number()),
      clockInLng: v.optional(v.number()),
      clockInAccuracy: v.optional(v.number()),
      clockInNotes: v.optional(v.string()),
      clockOutAt: v.optional(v.number()),
      clockOutLat: v.optional(v.number()),
      clockOutLng: v.optional(v.number()),
      clockOutAccuracy: v.optional(v.number()),
      clockOutNotes: v.optional(v.string()),
      status: v.union(v.literal("active"), v.literal("completed")),
      createdAt: v.number(),
    })
      .index("by_date", ["date"])
      .index("by_caregiverId", ["caregiverId"])
      .index("by_caregiverId_date", ["caregiverId", "date"])
      .index("by_status", ["status"]),

    auditLogs: defineTable({
      userId: v.optional(v.id("users")),
      action: v.string(),
      entityType: v.string(),
      entityId: v.optional(v.string()),
      oldValue: v.optional(v.string()),
      newValue: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_createdAt", ["createdAt"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
