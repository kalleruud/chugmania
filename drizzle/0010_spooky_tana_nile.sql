CREATE TABLE `webhooks` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`game_id` text NOT NULL,
	`type` text NOT NULL,
	`session` text,
	`received_at` integer NOT NULL,
	`payload` text NOT NULL,
	FOREIGN KEY (`session`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `webhooks_game_id_idx` ON `webhooks` (`game_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_time_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`user` text,
	`track` text,
	`session` text,
	`duration_ms` integer,
	`chug_duration_ms` integer,
	`publication_state` text DEFAULT 'published' NOT NULL,
	`webhook_game_id` text,
	`published_at` integer,
	`amount_l` integer DEFAULT 0.5 NOT NULL,
	`comment` text,
	FOREIGN KEY (`user`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`track`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_time_entries`("id", "updated_at", "created_at", "deleted_at", "user", "track", "session", "duration_ms", "chug_duration_ms", "publication_state", "webhook_game_id", "published_at", "amount_l", "comment") SELECT "id", "updated_at", "created_at", "deleted_at", "user", "track", "session", "duration_ms", NULL, 'published', NULL, "created_at", "amount_l", "comment" FROM `time_entries`;--> statement-breakpoint
DROP TABLE `time_entries`;--> statement-breakpoint
ALTER TABLE `__new_time_entries` RENAME TO `time_entries`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `time_entries_webhook_game_id_unique` ON `time_entries` (`webhook_game_id`);--> statement-breakpoint
ALTER TABLE `matches` ADD `user1_duration_ms` integer;--> statement-breakpoint
ALTER TABLE `matches` ADD `user2_duration_ms` integer;--> statement-breakpoint
ALTER TABLE `matches` ADD `user1_chug_duration_ms` integer;--> statement-breakpoint
ALTER TABLE `matches` ADD `user2_chug_duration_ms` integer;--> statement-breakpoint
ALTER TABLE `matches` ADD `publication_state` text DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE `matches` ADD `webhook_game_id` text;--> statement-breakpoint
ALTER TABLE `matches` ADD `published_at` integer;--> statement-breakpoint
UPDATE `matches` SET `published_at` = `created_at`;--> statement-breakpoint
CREATE UNIQUE INDEX `matches_webhook_game_id_unique` ON `matches` (`webhook_game_id`);--> statement-breakpoint
ALTER TABLE `tracks` ADD `uid` text;--> statement-breakpoint
ALTER TABLE `tracks` ADD `name` text;--> statement-breakpoint
ALTER TABLE `tracks` ADD `author` text;--> statement-breakpoint
ALTER TABLE `tracks` ADD `environment` text;--> statement-breakpoint
ALTER TABLE `tracks` ADD `map_type` text;--> statement-breakpoint
ALTER TABLE `tracks` ADD `author_medal_time_ms` integer;--> statement-breakpoint
ALTER TABLE `tracks` ADD `gold_medal_time_ms` integer;--> statement-breakpoint
ALTER TABLE `tracks` ADD `silver_medal_time_ms` integer;--> statement-breakpoint
ALTER TABLE `tracks` ADD `bronze_medal_time_ms` integer;--> statement-breakpoint
ALTER TABLE `tracks` ADD `is_laps` integer;--> statement-breakpoint
ALTER TABLE `tracks` ADD `total_laps` integer;--> statement-breakpoint
ALTER TABLE `tracks` ADD `checkpoints_per_lap` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `tracks_uid_unique` ON `tracks` (`uid`);
