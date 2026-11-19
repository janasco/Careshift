ALTER TABLE `assignments` ADD `patient_id` text REFERENCES patients(id);--> statement-breakpoint
CREATE INDEX `assignments_patient_id_idx` ON `assignments` (`patient_id`);