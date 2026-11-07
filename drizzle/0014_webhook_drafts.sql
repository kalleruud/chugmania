CREATE TABLE `webhook_captures` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`game_id` text NOT NULL,
	`session` text NOT NULL,
	`total_players` integer NOT NULL,
	`source_game` text NOT NULL,
	`plugin_name` text NOT NULL,
	`plugin_version` text NOT NULL,
	`ended_at` integer,
	`published_at` integer,
	FOREIGN KEY (`session`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_captures_game_id_unique` ON `webhook_captures` (`game_id`);--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`event_id` text NOT NULL,
	`capture` text NOT NULL,
	`sequence` integer NOT NULL,
	`type` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`raw_payload` text NOT NULL,
	FOREIGN KEY (`capture`) REFERENCES `webhook_captures`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_events_event_id_unique` ON `webhook_events` (`event_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_capture_sequence` ON `webhook_events` (`capture`,`sequence`);--> statement-breakpoint
CREATE TABLE `__new_time_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`user` text,
	`track` text,
	`session` text,
	`publication_state` text DEFAULT 'published' NOT NULL,
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
	CONSTRAINT "time_entry_published_assignment" CHECK("publication_state" = 'draft' OR ("user" IS NOT NULL AND "track" IS NOT NULL)),
	CONSTRAINT "time_entry_publication" CHECK("publication_state" IN ('draft', 'published')),
	CONSTRAINT "time_entry_status" CHECK("status" IN ('planned', 'completed', 'cancelled'))
);
--> statement-breakpoint
INSERT INTO `__new_time_entries`("id", "updated_at", "created_at", "deleted_at", "user", "track", "session", "duration_ms", "status", "tie_breaker", "amount_l", "comment") SELECT "id", "updated_at", "created_at", "deleted_at", "user", "track", "session", "duration_ms", "status", "tie_breaker", "amount_l", "comment" FROM `time_entries`;--> statement-breakpoint
DROP TABLE `time_entries`;--> statement-breakpoint
ALTER TABLE `__new_time_entries` RENAME TO `time_entries`;--> statement-breakpoint
CREATE UNIQUE INDEX `time_entries_webhook_capture_unique` ON `time_entries` (`webhook_capture`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_track_user_tie_breaker` ON `time_entries` (`session`,`track`,`user`) WHERE "time_entries"."tie_breaker" = 1;--> statement-breakpoint
CREATE TABLE `__new_tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`number` integer,
	`level` text NOT NULL,
	`type` text,
	`uid` text,
	`name` text,
	`author` text,
	`environment` text,
	`map_type` text,
	`author_medal_ms` integer,
	`gold_medal_ms` integer,
	`silver_medal_ms` integer,
	`bronze_medal_ms` integer,
	`is_laps` integer,
	`total_laps` integer,
	`checkpoints_per_lap` integer
);
--> statement-breakpoint
INSERT INTO `__new_tracks`("id", "updated_at", "created_at", "deleted_at", "number", "level", "type") SELECT "id", "updated_at", "created_at", "deleted_at", "number", "level", "type" FROM `tracks`;--> statement-breakpoint
DROP TABLE `tracks`;--> statement-breakpoint
ALTER TABLE `__new_tracks` RENAME TO `tracks`;--> statement-breakpoint
CREATE UNIQUE INDEX `tracks_uid_unique` ON `tracks` (`uid`);--> statement-breakpoint
ALTER TABLE `matches` ADD `publication_state` text DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE `matches` ADD `webhook_capture` text REFERENCES webhook_captures(id);--> statement-breakpoint
ALTER TABLE `matches` ADD `user1_duration_ms` integer;--> statement-breakpoint
ALTER TABLE `matches` ADD `user2_duration_ms` integer;--> statement-breakpoint
ALTER TABLE `matches` ADD `user1_chug_duration_ms` integer;--> statement-breakpoint
ALTER TABLE `matches` ADD `user2_chug_duration_ms` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `matches_webhook_capture_unique` ON `matches` (`webhook_capture`);
