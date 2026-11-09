PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_time_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`user` text,
	`track` text,
	`session` text,
	`webhook_capture` text,
	`chug_duration_ms` integer,
	`duration_ms` integer,
	`status` text DEFAULT 'completed' NOT NULL,
	`tie_breaker` integer DEFAULT false NOT NULL,
	`amount_l` integer DEFAULT 0.5 NOT NULL,
	`comment` text,
	FOREIGN KEY (`user`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`track`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`webhook_capture`) REFERENCES `webhook_captures`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "time_entry_status" CHECK("__new_time_entries"."status" IN ('planned', 'in_progress', 'draft', 'completed', 'cancelled'))
);
--> statement-breakpoint
INSERT INTO `__new_time_entries`("id", "updated_at", "created_at", "deleted_at", "user", "track", "session", "webhook_capture", "chug_duration_ms", "duration_ms", "status", "tie_breaker", "amount_l", "comment") SELECT "id", "updated_at", "created_at", "deleted_at", "user", "track", "session", "webhook_capture", "chug_duration_ms", "duration_ms", CASE WHEN "publication_state" = 'draft' THEN CASE WHEN EXISTS (SELECT 1 FROM webhook_events WHERE capture = "webhook_capture" AND type IN ('finish', 'end')) THEN 'draft' ELSE 'in_progress' END ELSE "status" END, "tie_breaker", "amount_l", "comment" FROM `time_entries`;--> statement-breakpoint
DROP TABLE `time_entries`;--> statement-breakpoint
ALTER TABLE `__new_time_entries` RENAME TO `time_entries`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `time_entries_webhook_capture_unique` ON `time_entries` (`webhook_capture`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_track_user_tie_breaker` ON `time_entries` (`session`,`track`,`user`) WHERE "time_entries"."tie_breaker" = 1;--> statement-breakpoint
UPDATE matches SET status = CASE WHEN "publication_state" = 'draft' THEN CASE WHEN EXISTS (SELECT 1 FROM webhook_events WHERE capture = "webhook_capture" AND type IN ('finish', 'end')) THEN 'draft' ELSE 'in_progress' END ELSE "status" END;
--> statement-breakpoint
ALTER TABLE `matches` DROP COLUMN `publication_state`;