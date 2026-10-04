PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_time_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`user` text NOT NULL,
	`track` text NOT NULL,
	`session` text,
	`duration_ms` integer,
	`status` text DEFAULT 'completed' NOT NULL,
	`tie_breaker` integer DEFAULT false NOT NULL,
	`amount_l` integer DEFAULT 0.5 NOT NULL,
	`comment` text,
	FOREIGN KEY (`user`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`track`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "time_entry_status" CHECK("status" IN ('planned', 'completed', 'cancelled'))
);
--> statement-breakpoint
INSERT INTO `__new_time_entries`("id", "updated_at", "created_at", "deleted_at", "user", "track", "session", "duration_ms", "amount_l", "comment") SELECT "id", "updated_at", "created_at", "deleted_at", "user", "track", "session", "duration_ms", "amount_l", "comment" FROM `time_entries`;--> statement-breakpoint
DROP TABLE `time_entries`;--> statement-breakpoint
ALTER TABLE `__new_time_entries` RENAME TO `time_entries`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `session_track_user_tie_breaker` ON `time_entries` (`session`,`track`,`user`) WHERE "time_entries"."tie_breaker" = 1;--> statement-breakpoint
ALTER TABLE `tournament_players` ADD `global_rank` integer;--> statement-breakpoint
ALTER TABLE `tournaments` ADD `tie_breaker_track` text REFERENCES tracks(id);
