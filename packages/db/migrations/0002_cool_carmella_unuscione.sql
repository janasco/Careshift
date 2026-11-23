CREATE TABLE `calendar_events` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text,
	`patient_name` text,
	`title` text NOT NULL,
	`event_type` text DEFAULT 'appointment' NOT NULL,
	`location` text,
	`notes` text,
	`start_ms` integer NOT NULL,
	`end_ms` integer,
	`all_day` integer DEFAULT false NOT NULL,
	`created_by_user_id` text,
	`created_by_name` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `calendar_events_start_ms_idx` ON `calendar_events` (`start_ms`);--> statement-breakpoint
CREATE INDEX `calendar_events_patient_id_idx` ON `calendar_events` (`patient_id`);