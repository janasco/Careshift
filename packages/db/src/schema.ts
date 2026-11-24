import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ── Better Auth core tables ───────────────────────────────────────────────

export const user = sqliteTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: integer("emailVerified", { mode: "boolean" })
      .notNull()
      .default(false),
    image: text("image"),
    role: text("role").notNull().default("caregiver"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [uniqueIndex("user_email_unique").on(table.email)],
);

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("session_token_unique").on(table.token),
    index("session_user_id_idx").on(table.userId),
  ],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refreshTokenExpiresAt", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("account_user_id_idx").on(table.userId),
    uniqueIndex("account_provider_account_unique").on(
      table.providerId,
      table.accountId,
    ),
  ],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// ── Domain tables ────────────────────────────────────────────────────────

export const shifts = sqliteTable("shifts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull(),
});

export const patients = sqliteTable(
  "patients",
  {
    id: text("id").primaryKey(),
    fullName: text("full_name").notNull(),
    preferredName: text("preferred_name"),
    aliases: text("aliases", { mode: "json" }).$type<string[]>(),
    dateOfBirth: text("date_of_birth"),
    room: text("room"),
    address: text("address"),
    primaryContactName: text("primary_contact_name"),
    primaryContactPhone: text("primary_contact_phone"),
    notes: text("notes"),
    status: text("status").notNull().default("active"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("patients_status_idx").on(table.status)],
);

export const profiles = sqliteTable(
  "profiles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("caregiver"),
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    employeeCode: text("employee_code"),
    shiftId: text("shift_id").references(() => shifts.id, {
      onDelete: "set null",
    }),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    lastLoginAt: integer("last_login_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("profiles_user_id_unique").on(table.userId),
    index("profiles_active_idx").on(table.active),
  ],
);

export const caregivers = sqliteTable(
  "caregivers",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    shiftId: text("shift_id").references(() => shifts.id, {
      onDelete: "set null",
    }),
    phone: text("phone"),
    employeeCode: text("employee_code"),
    status: text("status").notNull().default("active"),
    hiredAt: integer("hired_at"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("caregivers_user_id_unique").on(table.userId),
    index("caregivers_shift_id_idx").on(table.shiftId),
    index("caregivers_status_idx").on(table.status),
  ],
);

export const taskTemplates = sqliteTable(
  "task_templates",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category").notNull(),
    priority: text("priority").notNull(),
    estimatedDuration: integer("estimated_duration").notNull(),
    required: integer("required", { mode: "boolean" }).notNull().default(true),
    recurring: integer("recurring", { mode: "boolean" }).notNull().default(true),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("task_templates_active_idx").on(table.active)],
);

export const assignments = sqliteTable(
  "assignments",
  {
    id: text("id").primaryKey(),
    taskTemplateId: text("task_template_id")
      .notNull()
      .references(() => taskTemplates.id, { onDelete: "cascade" }),
    shiftId: text("shift_id")
      .notNull()
      .references(() => shifts.id, { onDelete: "cascade" }),
    caregiverId: text("caregiver_id").references(() => caregivers.id, {
      onDelete: "set null",
    }),
    patientId: text("patient_id").references(() => patients.id, {
      onDelete: "set null",
    }),
    scheduledTime: text("scheduled_time").notNull(),
    dueTime: text("due_time").notNull(),
    daysOfWeek: text("days_of_week", { mode: "json" })
      .$type<number[]>()
      .notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("assignments_shift_id_idx").on(table.shiftId),
    index("assignments_caregiver_id_idx").on(table.caregiverId),
    index("assignments_template_id_idx").on(table.taskTemplateId),
    index("assignments_patient_id_idx").on(table.patientId),
  ],
);

export const scheduledTasks = sqliteTable(
  "scheduled_tasks",
  {
    id: text("id").primaryKey(),
    assignmentId: text("assignment_id").references(() => assignments.id, {
      onDelete: "set null",
    }),
    templateId: text("template_id")
      .notNull()
      .references(() => taskTemplates.id, { onDelete: "cascade" }),
    caregiverId: text("caregiver_id")
      .notNull()
      .references(() => caregivers.id, { onDelete: "cascade" }),
    patientId: text("patient_id").references(() => patients.id, {
      onDelete: "set null",
    }),
    shiftId: text("shift_id")
      .notNull()
      .references(() => shifts.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    scheduledTime: text("scheduled_time").notNull(),
    dueMs: integer("due_ms").notNull(),
    shiftStartMs: integer("shift_start_ms").notNull(),
    shiftEndMs: integer("shift_end_ms").notNull(),
    status: text("status").notNull().default("pending"),
    completedAt: integer("completed_at"),
    completedByUserId: text("completed_by_user_id"),
    note: text("note"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("scheduled_tasks_date_idx").on(table.date),
    index("scheduled_tasks_caregiver_date_idx").on(table.caregiverId, table.date),
    index("scheduled_tasks_status_date_idx").on(table.status, table.date),
    index("scheduled_tasks_shift_id_idx").on(table.shiftId),
  ],
);

export const taskCompletions = sqliteTable(
  "task_completions",
  {
    id: text("id").primaryKey(),
    scheduledTaskId: text("scheduled_task_id")
      .notNull()
      .references(() => scheduledTasks.id, { onDelete: "cascade" }),
    caregiverId: text("caregiver_id")
      .notNull()
      .references(() => caregivers.id, { onDelete: "cascade" }),
    completedAt: integer("completed_at").notNull(),
    note: text("note"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("task_completions_task_id_idx").on(table.scheduledTaskId),
  ],
);

export const issues = sqliteTable(
  "issues",
  {
    id: text("id").primaryKey(),
    scheduledTaskId: text("scheduled_task_id")
      .notNull()
      .references(() => scheduledTasks.id, { onDelete: "cascade" }),
    caregiverId: text("caregiver_id")
      .notNull()
      .references(() => caregivers.id, { onDelete: "cascade" }),
    issueType: text("issue_type").notNull(),
    description: text("description").notNull(),
    status: text("status").notNull().default("open"),
    createdAt: integer("created_at").notNull(),
    resolvedAt: integer("resolved_at"),
    resolvedByUserId: text("resolved_by_user_id"),
  },
  (table) => [
    index("issues_status_idx").on(table.status),
    index("issues_task_id_idx").on(table.scheduledTaskId),
    index("issues_caregiver_id_idx").on(table.caregiverId),
  ],
);

export const vitalSigns = sqliteTable(
  "vital_signs",
  {
    id: text("id").primaryKey(),
    patientId: text("patient_id").references(() => patients.id, {
      onDelete: "set null",
    }),
    patientName: text("patient_name"),
    caregiverId: text("caregiver_id").references(() => caregivers.id, {
      onDelete: "set null",
    }),
    caregiverName: text("caregiver_name"),
    timeLabel: text("time_label"),
    bp: text("bp"),
    spo2: integer("spo2"),
    pulse: integer("pulse"),
    respiration: integer("respiration"),
    temperature: text("temperature"),
    notes: text("notes").notNull(),
    source: text("source"),
    importKey: text("import_key"),
    recordedAt: integer("recorded_at"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("vital_signs_import_key_unique").on(table.importKey),
    index("vital_signs_patient_id_idx").on(table.patientId),
    index("vital_signs_created_at_idx").on(table.createdAt),
  ],
);

export const careEvents = sqliteTable(
  "care_events",
  {
    id: text("id").primaryKey(),
    patientId: text("patient_id").references(() => patients.id, {
      onDelete: "set null",
    }),
    patientName: text("patient_name"),
    caregiverId: text("caregiver_id").references(() => caregivers.id, {
      onDelete: "set null",
    }),
    caregiverName: text("caregiver_name"),
    eventType: text("event_type").notNull(),
    severity: text("severity"),
    occurredAt: integer("occurred_at"),
    timeLabel: text("time_label"),
    notes: text("notes").notNull(),
    source: text("source"),
    importKey: text("import_key"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("care_events_import_key_unique").on(table.importKey),
    index("care_events_patient_id_idx").on(table.patientId),
    index("care_events_created_at_idx").on(table.createdAt),
    index("care_events_type_idx").on(table.eventType),
  ],
);

export const medications = sqliteTable(
  "medications",
  {
    id: text("id").primaryKey(),
    patientId: text("patient_id").references(() => patients.id, {
      onDelete: "set null",
    }),
    patientName: text("patient_name"),
    name: text("name").notNull(),
    dosage: text("dosage"),
    route: text("route"),
    frequency: text("frequency"),
    times: text("times", { mode: "json" }).$type<string[]>().notNull(),
    startDate: text("start_date"),
    endDate: text("end_date"),
    instructions: text("instructions"),
    stock: real("stock"),
    refillThreshold: real("refill_threshold"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("medications_patient_id_idx").on(table.patientId),
    index("medications_active_idx").on(table.active),
  ],
);

export const medicationLogs = sqliteTable(
  "medication_logs",
  {
    id: text("id").primaryKey(),
    medicationId: text("medication_id")
      .notNull()
      .references(() => medications.id, { onDelete: "cascade" }),
    patientId: text("patient_id").references(() => patients.id, {
      onDelete: "set null",
    }),
    caregiverId: text("caregiver_id").references(() => caregivers.id, {
      onDelete: "set null",
    }),
    caregiverName: text("caregiver_name"),
    date: text("date").notNull(),
    scheduledTime: text("scheduled_time").notNull(),
    status: text("status").notNull(),
    takenAt: integer("taken_at"),
    skipReason: text("skip_reason"),
    notes: text("notes"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("medication_logs_dose_unique").on(
      table.medicationId,
      table.date,
      table.scheduledTime,
    ),
    index("medication_logs_date_idx").on(table.date),
    index("medication_logs_patient_id_idx").on(table.patientId),
  ],
);

export const visits = sqliteTable(
  "visits",
  {
    id: text("id").primaryKey(),
    caregiverId: text("caregiver_id")
      .notNull()
      .references(() => caregivers.id, { onDelete: "cascade" }),
    caregiverName: text("caregiver_name"),
    shiftId: text("shift_id").references(() => shifts.id, {
      onDelete: "set null",
    }),
    date: text("date").notNull(),
    clockInAt: integer("clock_in_at").notNull(),
    clockInLat: real("clock_in_lat"),
    clockInLng: real("clock_in_lng"),
    clockInAccuracy: real("clock_in_accuracy"),
    clockInNotes: text("clock_in_notes"),
    clockOutAt: integer("clock_out_at"),
    clockOutLat: real("clock_out_lat"),
    clockOutLng: real("clock_out_lng"),
    clockOutAccuracy: real("clock_out_accuracy"),
    clockOutNotes: text("clock_out_notes"),
    status: text("status").notNull().default("active"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("visits_date_idx").on(table.date),
    index("visits_caregiver_id_idx").on(table.caregiverId),
    index("visits_caregiver_date_idx").on(table.caregiverId, table.date),
    index("visits_status_idx").on(table.status),
    index("visits_shift_id_idx").on(table.shiftId),
  ],
);

export const calendarEvents = sqliteTable(
  "calendar_events",
  {
    id: text("id").primaryKey(),
    patientId: text("patient_id").references(() => patients.id, {
      onDelete: "set null",
    }),
    patientName: text("patient_name"),
    title: text("title").notNull(),
    eventType: text("event_type").notNull().default("appointment"),
    location: text("location"),
    notes: text("notes"),
    startMs: integer("start_ms").notNull(),
    endMs: integer("end_ms"),
    allDay: integer("all_day", { mode: "boolean" }).notNull().default(false),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdByName: text("created_by_name"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("calendar_events_start_ms_idx").on(table.startMs),
    index("calendar_events_patient_id_idx").on(table.patientId),
  ],
);

export const pushTokens = sqliteTable(
  "push_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    platform: text("platform").notNull().default("android"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    lastSeenAt: integer("last_seen_at").notNull(),
  },
  (table) => [
    uniqueIndex("push_tokens_token_unique").on(table.token),
    index("push_tokens_user_id_idx").on(table.userId),
  ],
);

export const pushLogs = sqliteTable(
  "push_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    entityId: text("entity_id").notNull(),
    scheduledFor: integer("scheduled_for").notNull(),
    sentAt: integer("sent_at").notNull(),
  },
  (table) => [
    uniqueIndex("push_logs_unique").on(
      table.type,
      table.entityId,
      table.userId,
      table.scheduledFor,
    ),
    index("push_logs_sent_at_idx").on(table.sentAt),
  ],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("audit_logs_created_at_idx").on(table.createdAt)],
);

export const schema = {
  user,
  session,
  account,
  verification,
  shifts,
  patients,
  profiles,
  caregivers,
  taskTemplates,
  assignments,
  scheduledTasks,
  taskCompletions,
  issues,
  vitalSigns,
  careEvents,
  medications,
  medicationLogs,
  visits,
  calendarEvents,
  pushTokens,
  pushLogs,
  auditLogs,
};

export type Schema = typeof schema;
