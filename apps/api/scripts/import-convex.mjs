#!/usr/bin/env node
/**
 * Export the local Convex database and generate a D1 SQL import file.
 *
 * Convex Auth passwords cannot be carried over because Better Auth hashes
 * passwords differently. Every imported account gets the temporary password
 * below and must be reset by the admin after cutover.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashPassword } from "better-auth/crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const outFile =
  process.env.IMPORT_SQL_PATH ?? "/tmp/opencode/careshift-import.sql";
const tempPassword = process.env.IMPORT_TEMP_PASSWORD;

if (!tempPassword || tempPassword.length < 8) {
  console.error(
    "Set IMPORT_TEMP_PASSWORD (at least 8 characters) before running this import.",
  );
  process.exit(1);
}

const tables = [
  "users",
  "profiles",
  "shifts",
  "patients",
  "caregivers",
  "taskTemplates",
  "assignments",
  "scheduledTasks",
  "taskCompletions",
  "issues",
  "vitalSigns",
  "careEvents",
  "medications",
  "medicationLogs",
  "visits",
  "auditLogs",
];

function exportTable(table) {
  const output = execFileSync(
    "npx",
    ["convex", "data", table, "--format", "json", "--limit", "1000"],
    {
      cwd: repoRoot,
      env: { ...process.env, CONVEX_AGENT_MODE: "anonymous" },
      encoding: "utf8",
      maxBuffer: 100 * 1024 * 1024,
    },
  );
  const start = output.indexOf("[");
  const end = output.lastIndexOf("]");
  if (start === -1 || end === -1) return [];
  return JSON.parse(output.slice(start, end + 1));
}

function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(Math.round(value * 1000) / 1000) : "NULL";
  }
  if (typeof value === "object") {
    return sqlValue(JSON.stringify(value));
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function insert(table, columns, rows) {
  if (rows.length === 0) return "";
  const values = rows
    .map(
      (row) =>
        `(${columns.map((column) => sqlValue(row[column])).join(", ")})`,
    )
    .join(",\n");
  return `INSERT INTO ${table} (${columns.join(", ")}) VALUES\n${values};\n`;
}

/** Insert using [databaseColumn, rowProperty] pairs. */
function insertMapped(table, columns, rows) {
  if (rows.length === 0) return "";
  const values = rows
    .map(
      (row) =>
        `(${columns
          .map(([, property]) => sqlValue(row[property]))
          .join(", ")})`,
    )
    .join(",\n");
  const names = columns.map(([name]) => name).join(", ");
  return `INSERT INTO ${table} (${names}) VALUES\n${values};\n`;
}

const docs = Object.fromEntries(tables.map((table) => [table, exportTable(table)]));
const profilesByUser = new Map(
  docs.profiles.map((profile) => [profile.userId, profile]),
);
const now = Date.now();

const passwordHash = await hashPassword(tempPassword);

const userRows = docs.users.map((user) => {
  const profile = profilesByUser.get(user._id);
  return {
    id: user._id,
    name: user.name ?? profile?.fullName ?? "CareShift user",
    email: (user.email ?? "").toLowerCase(),
    emailVerified: 0,
    image: null,
    role: profile?.role ?? "caregiver",
    createdAt: user._creationTime ?? now,
    updatedAt: user._creationTime ?? now,
  };
});

const accountRows = userRows.map((user) => ({
  id: `credential-${user.id}`,
  accountId: user.id,
  providerId: "credential",
  userId: user.id,
  password: passwordHash,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
}));

const profileRows = docs.profiles.map((profile) => ({
  id: profile._id,
  userId: profile.userId,
  role: profile.role,
  fullName: profile.fullName,
  phone: profile.phone ?? null,
  employeeCode: profile.employeeCode ?? null,
  shiftId: profile.shiftId ?? null,
  active: profile.active ?? true,
  lastLoginAt: profile.lastLoginAt ?? null,
  createdAt: profile._creationTime ?? now,
  updatedAt: profile._creationTime ?? now,
}));

const shiftRows = docs.shifts.map((shift) => ({
  id: shift._id,
  name: shift.name,
  startTime: shift.startTime,
  endTime: shift.endTime,
  active: shift.active ?? true,
  createdAt: shift._creationTime ?? now,
}));

const patientRows = docs.patients.map((patient) => ({
  id: patient._id,
  fullName: patient.fullName,
  preferredName: patient.preferredName ?? null,
  aliases: patient.aliases ?? null,
  dateOfBirth: patient.dateOfBirth ?? null,
  room: patient.room ?? null,
  address: patient.address ?? null,
  primaryContactName: patient.primaryContactName ?? null,
  primaryContactPhone: patient.primaryContactPhone ?? null,
  notes: patient.notes ?? null,
  status: patient.status ?? "active",
  createdAt: patient._creationTime ?? now,
}));

const caregiverRows = docs.caregivers.map((caregiver) => ({
  id: caregiver._id,
  userId: caregiver.userId,
  shiftId: caregiver.shiftId ?? null,
  phone: caregiver.phone ?? null,
  employeeCode: caregiver.employeeCode ?? null,
  status: caregiver.status ?? "active",
  hiredAt: caregiver.hiredAt ?? null,
  createdAt: caregiver._creationTime ?? now,
}));

const templateRows = docs.taskTemplates.map((template) => ({
  id: template._id,
  name: template.name,
  description: template.description ?? null,
  category: template.category,
  priority: template.priority,
  estimatedDuration: template.estimatedDuration,
  required: template.required ?? true,
  recurring: template.recurring ?? true,
  active: template.active ?? true,
  createdAt: template._creationTime ?? now,
}));

const assignmentRows = docs.assignments.map((assignment) => ({
  id: assignment._id,
  taskTemplateId: assignment.taskTemplateId,
  shiftId: assignment.shiftId,
  caregiverId: assignment.caregiverId ?? null,
  scheduledTime: assignment.scheduledTime,
  dueTime: assignment.dueTime,
  daysOfWeek: assignment.daysOfWeek,
  active: assignment.active ?? true,
  createdAt: assignment._creationTime ?? now,
}));

const scheduledRows = docs.scheduledTasks.map((task) => ({
  id: task._id,
  assignmentId: task.assignmentId ?? null,
  templateId: task.templateId,
  caregiverId: task.caregiverId,
  patientId: task.patientId ?? null,
  shiftId: task.shiftId,
  date: task.date,
  scheduledTime: task.scheduledTime,
  dueMs: task.dueMs,
  shiftStartMs: task.shiftStartMs,
  shiftEndMs: task.shiftEndMs,
  status: task.status,
  completedAt: task.completedAt ?? null,
  completedByUserId: task.completedByUserId ?? null,
  note: task.note ?? null,
  createdAt: task._creationTime ?? now,
}));

const completionRows = docs.taskCompletions.map((completion) => ({
  id: completion._id,
  scheduledTaskId: completion.scheduledTaskId,
  caregiverId: completion.caregiverId,
  completedAt: completion.completedAt,
  note: completion.note ?? null,
  createdAt: completion._creationTime ?? now,
}));

const issueRows = docs.issues.map((issue) => ({
  id: issue._id,
  scheduledTaskId: issue.scheduledTaskId,
  caregiverId: issue.caregiverId,
  issueType: issue.issueType,
  description: issue.description,
  status: issue.status,
  createdAt: issue.createdAt ?? issue._creationTime ?? now,
  resolvedAt: issue.resolvedAt ?? null,
  resolvedByUserId: issue.resolvedByUserId ?? null,
}));

const vitalRows = docs.vitalSigns.map((vital) => ({
  id: vital._id,
  patientId: vital.patientId ?? null,
  patientName: vital.patientName ?? null,
  caregiverId: vital.caregiverId ?? null,
  caregiverName: vital.caregiverName ?? null,
  timeLabel: vital.timeLabel ?? null,
  bp: vital.bp ?? null,
  spo2: vital.spo2 ?? null,
  pulse: vital.pulse ?? null,
  respiration: vital.respiration ?? null,
  temperature: vital.temperature ?? null,
  notes: vital.notes,
  source: vital.source ?? "convex-import",
  importKey: vital.importKey ?? null,
  recordedAt: vital.recordedAt ?? null,
  createdAt: vital.createdAt ?? vital._creationTime ?? now,
}));

const eventRows = docs.careEvents.map((event) => ({
  id: event._id,
  patientId: event.patientId ?? null,
  patientName: event.patientName ?? null,
  caregiverId: event.caregiverId ?? null,
  caregiverName: event.caregiverName ?? null,
  eventType: event.eventType,
  severity: event.severity ?? null,
  occurredAt: event.occurredAt ?? null,
  timeLabel: event.timeLabel ?? null,
  notes: event.notes,
  source: event.source ?? "convex-import",
  importKey: event.importKey ?? null,
  createdAt: event.createdAt ?? event._creationTime ?? now,
}));

const medicationRows = docs.medications.map((medication) => ({
  id: medication._id,
  patientId: medication.patientId ?? null,
  patientName: medication.patientName ?? null,
  name: medication.name,
  dosage: medication.dosage ?? null,
  route: medication.route ?? null,
  frequency: medication.frequency ?? null,
  times: medication.times ?? [],
  startDate: medication.startDate ?? null,
  endDate: medication.endDate ?? null,
  instructions: medication.instructions ?? null,
  stock: medication.stock ?? null,
  refillThreshold: medication.refillThreshold ?? null,
  active: medication.active ?? true,
  createdAt: medication.createdAt ?? medication._creationTime ?? now,
}));

const medLogRows = docs.medicationLogs.map((log) => ({
  id: log._id,
  medicationId: log.medicationId,
  patientId: log.patientId ?? null,
  caregiverId: log.caregiverId ?? null,
  caregiverName: log.caregiverName ?? null,
  date: log.date,
  scheduledTime: log.scheduledTime,
  status: log.status,
  takenAt: log.takenAt ?? null,
  skipReason: log.skipReason ?? null,
  notes: log.notes ?? null,
  createdAt: log.createdAt ?? log._creationTime ?? now,
}));

const visitRows = docs.visits.map((visit) => ({
  id: visit._id,
  caregiverId: visit.caregiverId,
  caregiverName: visit.caregiverName ?? null,
  shiftId: visit.shiftId ?? null,
  date: visit.date,
  clockInAt: visit.clockInAt,
  clockInLat: visit.clockInLat ?? null,
  clockInLng: visit.clockInLng ?? null,
  clockInAccuracy: visit.clockInAccuracy ?? null,
  clockInNotes: visit.clockInNotes ?? null,
  clockOutAt: visit.clockOutAt ?? null,
  clockOutLat: visit.clockOutLat ?? null,
  clockOutLng: visit.clockOutLng ?? null,
  clockOutAccuracy: visit.clockOutAccuracy ?? null,
  clockOutNotes: visit.clockOutNotes ?? null,
  status: visit.status,
  createdAt: visit.createdAt ?? visit._creationTime ?? now,
}));

const auditRows = docs.auditLogs.map((log) => ({
  id: log._id,
  userId: log.userId ?? null,
  action: log.action,
  entityType: log.entityType,
  entityId: log.entityId ?? null,
  oldValue: log.oldValue ?? null,
  newValue: log.newValue ?? null,
  createdAt: log.createdAt ?? log._creationTime ?? now,
}));

const deleteOrder = [
  "task_completions",
  "issues",
  "scheduled_tasks",
  "assignments",
  "medication_logs",
  "medications",
  "care_events",
  "vital_signs",
  "visits",
  "caregivers",
  "profiles",
  "task_templates",
  "patients",
  "audit_logs",
  "account",
  "session",
  "verification",
  "user",
  "shifts",
];

let sql = "";
for (const table of deleteOrder) sql += `DELETE FROM ${table};\n`;
sql += "\n";
sql += insertMapped("user", [["id", "id"], ["name", "name"], ["email", "email"], ["emailVerified", "emailVerified"], ["image", "image"], ["role", "role"], ["createdAt", "createdAt"], ["updatedAt", "updatedAt"]], userRows);
sql += insertMapped("account", [["id", "id"], ["accountId", "accountId"], ["providerId", "providerId"], ["userId", "userId"], ["password", "password"], ["createdAt", "createdAt"], ["updatedAt", "updatedAt"]], accountRows);
sql += insertMapped("shifts", [["id", "id"], ["name", "name"], ["start_time", "startTime"], ["end_time", "endTime"], ["active", "active"], ["created_at", "createdAt"]], shiftRows);
sql += insertMapped("patients", [["id", "id"], ["full_name", "fullName"], ["preferred_name", "preferredName"], ["aliases", "aliases"], ["date_of_birth", "dateOfBirth"], ["room", "room"], ["address", "address"], ["primary_contact_name", "primaryContactName"], ["primary_contact_phone", "primaryContactPhone"], ["notes", "notes"], ["status", "status"], ["created_at", "createdAt"]], patientRows);
sql += insertMapped("profiles", [["id", "id"], ["user_id", "userId"], ["role", "role"], ["full_name", "fullName"], ["phone", "phone"], ["employee_code", "employeeCode"], ["shift_id", "shiftId"], ["active", "active"], ["last_login_at", "lastLoginAt"], ["created_at", "createdAt"], ["updated_at", "updatedAt"]], profileRows);
sql += insertMapped("caregivers", [["id", "id"], ["user_id", "userId"], ["shift_id", "shiftId"], ["phone", "phone"], ["employee_code", "employeeCode"], ["status", "status"], ["hired_at", "hiredAt"], ["created_at", "createdAt"]], caregiverRows);
sql += insertMapped("task_templates", [["id", "id"], ["name", "name"], ["description", "description"], ["category", "category"], ["priority", "priority"], ["estimated_duration", "estimatedDuration"], ["required", "required"], ["recurring", "recurring"], ["active", "active"], ["created_at", "createdAt"]], templateRows);
sql += insertMapped("assignments", [["id", "id"], ["task_template_id", "taskTemplateId"], ["shift_id", "shiftId"], ["caregiver_id", "caregiverId"], ["scheduled_time", "scheduledTime"], ["due_time", "dueTime"], ["days_of_week", "daysOfWeek"], ["active", "active"], ["created_at", "createdAt"]], assignmentRows);
sql += insertMapped("scheduled_tasks", [["id", "id"], ["assignment_id", "assignmentId"], ["template_id", "templateId"], ["caregiver_id", "caregiverId"], ["patient_id", "patientId"], ["shift_id", "shiftId"], ["date", "date"], ["scheduled_time", "scheduledTime"], ["due_ms", "dueMs"], ["shift_start_ms", "shiftStartMs"], ["shift_end_ms", "shiftEndMs"], ["status", "status"], ["completed_at", "completedAt"], ["completed_by_user_id", "completedByUserId"], ["note", "note"], ["created_at", "createdAt"]], scheduledRows);
sql += insertMapped("task_completions", [["id", "id"], ["scheduled_task_id", "scheduledTaskId"], ["caregiver_id", "caregiverId"], ["completed_at", "completedAt"], ["note", "note"], ["created_at", "createdAt"]], completionRows);
sql += insertMapped("issues", [["id", "id"], ["scheduled_task_id", "scheduledTaskId"], ["caregiver_id", "caregiverId"], ["issue_type", "issueType"], ["description", "description"], ["status", "status"], ["created_at", "createdAt"], ["resolved_at", "resolvedAt"], ["resolved_by_user_id", "resolvedByUserId"]], issueRows);
sql += insertMapped("vital_signs", [["id", "id"], ["patient_id", "patientId"], ["patient_name", "patientName"], ["caregiver_id", "caregiverId"], ["caregiver_name", "caregiverName"], ["time_label", "timeLabel"], ["bp", "bp"], ["spo2", "spo2"], ["pulse", "pulse"], ["respiration", "respiration"], ["temperature", "temperature"], ["notes", "notes"], ["source", "source"], ["import_key", "importKey"], ["recorded_at", "recordedAt"], ["created_at", "createdAt"]], vitalRows);
sql += insertMapped("care_events", [["id", "id"], ["patient_id", "patientId"], ["patient_name", "patientName"], ["caregiver_id", "caregiverId"], ["caregiver_name", "caregiverName"], ["event_type", "eventType"], ["severity", "severity"], ["occurred_at", "occurredAt"], ["time_label", "timeLabel"], ["notes", "notes"], ["source", "source"], ["import_key", "importKey"], ["created_at", "createdAt"]], eventRows);
sql += insertMapped("medications", [["id", "id"], ["patient_id", "patientId"], ["patient_name", "patientName"], ["name", "name"], ["dosage", "dosage"], ["route", "route"], ["frequency", "frequency"], ["times", "times"], ["start_date", "startDate"], ["end_date", "endDate"], ["instructions", "instructions"], ["stock", "stock"], ["refill_threshold", "refillThreshold"], ["active", "active"], ["created_at", "createdAt"]], medicationRows);
sql += insertMapped("medication_logs", [["id", "id"], ["medication_id", "medicationId"], ["patient_id", "patientId"], ["caregiver_id", "caregiverId"], ["caregiver_name", "caregiverName"], ["date", "date"], ["scheduled_time", "scheduledTime"], ["status", "status"], ["taken_at", "takenAt"], ["skip_reason", "skipReason"], ["notes", "notes"], ["created_at", "createdAt"]], medLogRows);
sql += insertMapped("visits", [["id", "id"], ["caregiver_id", "caregiverId"], ["caregiver_name", "caregiverName"], ["shift_id", "shiftId"], ["date", "date"], ["clock_in_at", "clockInAt"], ["clock_in_lat", "clockInLat"], ["clock_in_lng", "clockInLng"], ["clock_in_accuracy", "clockInAccuracy"], ["clock_in_notes", "clockInNotes"], ["clock_out_at", "clockOutAt"], ["clock_out_lat", "clockOutLat"], ["clock_out_lng", "clockOutLng"], ["clock_out_accuracy", "clockOutAccuracy"], ["clock_out_notes", "clockOutNotes"], ["status", "status"], ["created_at", "createdAt"]], visitRows);
sql += insertMapped("audit_logs", [["id", "id"], ["user_id", "userId"], ["action", "action"], ["entity_type", "entityType"], ["entity_id", "entityId"], ["old_value", "oldValue"], ["new_value", "newValue"], ["created_at", "createdAt"]], auditRows);

writeFileSync(outFile, sql, "utf8");

console.log(
  JSON.stringify(
    {
      outFile,
      users: userRows.length,
      profiles: profileRows.length,
      patients: patientRows.length,
      caregivers: caregiverRows.length,
      vitals: vitalRows.length,
      careEvents: eventRows.length,
      medications: medicationRows.length,
      visits: visitRows.length,
      auditLogs: auditRows.length,
    },
    null,
    2,
  ),
);
