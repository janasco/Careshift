import { z } from "zod";
import { zId } from "./validators";

export const CaregiverSchema = z.object({
  fullName: z.string().trim().min(2, "Name is required"),
  email: z.string().trim().email("A valid email is required"),
  phone: z.string().trim().min(7, "Phone is required"),
  employeeCode: z.string().trim().min(2, "Employee code is required"),
  shiftId: zId,
});

export const IssueSchema = z.object({
  issueType: z.string().min(1, "Pick an issue type"),
  description: z.string().trim().min(3, "Describe the issue"),
});

export const ShiftSchema = z.object({
  name: z.string().trim().min(2, "Shift name is required"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Start time required"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "End time required"),
});

export const TaskSchema = z.object({
  name: z.string().trim().min(2, "Task name is required"),
  description: z.string().trim().optional(),
  category: z.string().min(1, "Pick a category"),
  priority: z.string().min(1),
  estimatedDuration: z.number().min(1).max(480),
  required: z.boolean(),
  recurring: z.boolean(),
});

export const AssignmentSchema = z.object({
  taskTemplateId: zId,
  shiftId: zId,
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/, "Scheduled time required"),
  daysOfWeek: z.array(z.number()).min(1, "Pick at least one day"),
  caregiverId: zId.optional(),
  active: z.boolean(),
});
