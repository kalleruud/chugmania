ALTER TABLE `session_signups` ADD `created_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `sessions` ADD `created_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `time_entries` ADD `created_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `tracks` ADD `created_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `users` ADD `created_by` text REFERENCES users(id);
UPDATE `users` SET `created_by` = `id` WHERE `created_by` IS NULL;--> statement-breakpoint
UPDATE `time_entries` SET `created_by` = `user` WHERE `created_by` IS NULL;--> statement-breakpoint
UPDATE `session_signups` SET `created_by` = `user` WHERE `created_by` IS NULL;
