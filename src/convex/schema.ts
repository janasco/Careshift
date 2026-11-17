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
