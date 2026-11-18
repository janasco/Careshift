CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`userId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`password` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`userId`);--> statement-breakpoint
CREATE UNIQUE INDEX `account_provider_account_unique` ON `account` (`providerId`,`accountId`);--> statement-breakpoint
CREATE TABLE `assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`task_template_id` text NOT NULL,
	`shift_id` text NOT NULL,
	`caregiver_id` text,
	`scheduled_time` text NOT NULL,
	`due_time` text NOT NULL,
	`days_of_week` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`task_template_id`) REFERENCES `task_templates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`caregiver_id`) REFERENCES `caregivers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `assignments_shift_id_idx` ON `assignments` (`shift_id`);--> statement-breakpoint
CREATE INDEX `assignments_caregiver_id_idx` ON `assignments` (`caregiver_id`);--> statement-breakpoint
CREATE INDEX `assignments_template_id_idx` ON `assignments` (`task_template_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`old_value` text,
	`new_value` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_logs_created_at_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `care_events` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text,
	`patient_name` text,
	`caregiver_id` text,
	`caregiver_name` text,
	`event_type` text NOT NULL,
	`severity` text,
	`occurred_at` integer,
	`time_label` text,
	`notes` text NOT NULL,
	`source` text,
	`import_key` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`caregiver_id`) REFERENCES `caregivers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `care_events_import_key_unique` ON `care_events` (`import_key`);--> statement-breakpoint
CREATE INDEX `care_events_patient_id_idx` ON `care_events` (`patient_id`);--> statement-breakpoint
CREATE INDEX `care_events_created_at_idx` ON `care_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `care_events_type_idx` ON `care_events` (`event_type`);--> statement-breakpoint
CREATE TABLE `caregivers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`shift_id` text,
	`phone` text,
	`employee_code` text,
	`status` text DEFAULT 'active' NOT NULL,
	`hired_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `caregivers_user_id_unique` ON `caregivers` (`user_id`);--> statement-breakpoint
CREATE INDEX `caregivers_shift_id_idx` ON `caregivers` (`shift_id`);--> statement-breakpoint
CREATE INDEX `caregivers_status_idx` ON `caregivers` (`status`);--> statement-breakpoint
CREATE TABLE `issues` (
	`id` text PRIMARY KEY NOT NULL,
	`scheduled_task_id` text NOT NULL,
	`caregiver_id` text NOT NULL,
	`issue_type` text NOT NULL,
	`description` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	`resolved_at` integer,
	`resolved_by_user_id` text,
	FOREIGN KEY (`scheduled_task_id`) REFERENCES `scheduled_tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`caregiver_id`) REFERENCES `caregivers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `issues_status_idx` ON `issues` (`status`);--> statement-breakpoint
CREATE INDEX `issues_task_id_idx` ON `issues` (`scheduled_task_id`);--> statement-breakpoint
CREATE INDEX `issues_caregiver_id_idx` ON `issues` (`caregiver_id`);--> statement-breakpoint
CREATE TABLE `medication_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`medication_id` text NOT NULL,
	`patient_id` text,
	`caregiver_id` text,
	`caregiver_name` text,
	`date` text NOT NULL,
	`scheduled_time` text NOT NULL,
	`status` text NOT NULL,
	`taken_at` integer,
	`skip_reason` text,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`medication_id`) REFERENCES `medications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`caregiver_id`) REFERENCES `caregivers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `medication_logs_dose_unique` ON `medication_logs` (`medication_id`,`date`,`scheduled_time`);--> statement-breakpoint
CREATE INDEX `medication_logs_date_idx` ON `medication_logs` (`date`);--> statement-breakpoint
CREATE INDEX `medication_logs_patient_id_idx` ON `medication_logs` (`patient_id`);--> statement-breakpoint
CREATE TABLE `medications` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text,
	`patient_name` text,
	`name` text NOT NULL,
	`dosage` text,
	`route` text,
	`frequency` text,
	`times` text NOT NULL,
	`start_date` text,
	`end_date` text,
	`instructions` text,
	`stock` real,
	`refill_threshold` real,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `medications_patient_id_idx` ON `medications` (`patient_id`);--> statement-breakpoint
CREATE INDEX `medications_active_idx` ON `medications` (`active`);--> statement-breakpoint
CREATE TABLE `patients` (
	`id` text PRIMARY KEY NOT NULL,
	`full_name` text NOT NULL,
	`preferred_name` text,
	`aliases` text,
	`date_of_birth` text,
	`room` text,
	`address` text,
	`primary_contact_name` text,
	`primary_contact_phone` text,
	`notes` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `patients_status_idx` ON `patients` (`status`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'caregiver' NOT NULL,
	`full_name` text NOT NULL,
	`phone` text,
	`employee_code` text,
	`shift_id` text,
	`active` integer DEFAULT true NOT NULL,
	`last_login_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_user_id_unique` ON `profiles` (`user_id`);--> statement-breakpoint
CREATE INDEX `profiles_active_idx` ON `profiles` (`active`);--> statement-breakpoint
CREATE TABLE `scheduled_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`assignment_id` text,
	`template_id` text NOT NULL,
	`caregiver_id` text NOT NULL,
	`patient_id` text,
	`shift_id` text NOT NULL,
	`date` text NOT NULL,
	`scheduled_time` text NOT NULL,
	`due_ms` integer NOT NULL,
	`shift_start_ms` integer NOT NULL,
	`shift_end_ms` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`completed_at` integer,
	`completed_by_user_id` text,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`template_id`) REFERENCES `task_templates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`caregiver_id`) REFERENCES `caregivers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scheduled_tasks_date_idx` ON `scheduled_tasks` (`date`);--> statement-breakpoint
CREATE INDEX `scheduled_tasks_caregiver_date_idx` ON `scheduled_tasks` (`caregiver_id`,`date`);--> statement-breakpoint
CREATE INDEX `scheduled_tasks_status_date_idx` ON `scheduled_tasks` (`status`,`date`);--> statement-breakpoint
CREATE INDEX `scheduled_tasks_shift_id_idx` ON `scheduled_tasks` (`shift_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expiresAt` integer NOT NULL,
	`token` text NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`userId` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`userId`);--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `task_completions` (
	`id` text PRIMARY KEY NOT NULL,
	`scheduled_task_id` text NOT NULL,
	`caregiver_id` text NOT NULL,
	`completed_at` integer NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`scheduled_task_id`) REFERENCES `scheduled_tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`caregiver_id`) REFERENCES `caregivers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `task_completions_task_id_idx` ON `task_completions` (`scheduled_task_id`);--> statement-breakpoint
CREATE TABLE `task_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`category` text NOT NULL,
	`priority` text NOT NULL,
	`estimated_duration` integer NOT NULL,
	`required` integer DEFAULT true NOT NULL,
	`recurring` integer DEFAULT true NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `task_templates_active_idx` ON `task_templates` (`active`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer DEFAULT false NOT NULL,
	`image` text,
	`role` text DEFAULT 'caregiver' NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `visits` (
	`id` text PRIMARY KEY NOT NULL,
	`caregiver_id` text NOT NULL,
	`caregiver_name` text,
	`shift_id` text,
	`date` text NOT NULL,
	`clock_in_at` integer NOT NULL,
	`clock_in_lat` real,
	`clock_in_lng` real,
	`clock_in_accuracy` real,
	`clock_in_notes` text,
	`clock_out_at` integer,
	`clock_out_lat` real,
	`clock_out_lng` real,
	`clock_out_accuracy` real,
	`clock_out_notes` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`caregiver_id`) REFERENCES `caregivers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `visits_date_idx` ON `visits` (`date`);--> statement-breakpoint
CREATE INDEX `visits_caregiver_id_idx` ON `visits` (`caregiver_id`);--> statement-breakpoint
CREATE INDEX `visits_caregiver_date_idx` ON `visits` (`caregiver_id`,`date`);--> statement-breakpoint
CREATE INDEX `visits_status_idx` ON `visits` (`status`);--> statement-breakpoint
CREATE INDEX `visits_shift_id_idx` ON `visits` (`shift_id`);--> statement-breakpoint
CREATE TABLE `vital_signs` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text,
	`patient_name` text,
	`caregiver_id` text,
	`caregiver_name` text,
	`time_label` text,
	`bp` text,
	`spo2` integer,
	`pulse` integer,
	`respiration` integer,
	`temperature` text,
	`notes` text NOT NULL,
	`source` text,
	`import_key` text,
	`recorded_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`caregiver_id`) REFERENCES `caregivers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vital_signs_import_key_unique` ON `vital_signs` (`import_key`);--> statement-breakpoint
CREATE INDEX `vital_signs_patient_id_idx` ON `vital_signs` (`patient_id`);--> statement-breakpoint
CREATE INDEX `vital_signs_created_at_idx` ON `vital_signs` (`created_at`);