PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`level` text NOT NULL,
	`type` text NOT NULL,
	`game` text NOT NULL,
	`uid` text,
	`name` text NOT NULL,
	`author` text,
	`environment` text,
	`author_medal_ms` integer,
	`gold_medal_ms` integer,
	`silver_medal_ms` integer,
	`bronze_medal_ms` integer,
	`is_laps` integer,
	`total_laps` integer,
	`checkpoints_per_lap` integer
);
--> statement-breakpoint
INSERT INTO `__new_tracks`("id", "updated_at", "created_at", "deleted_at", "level", "type", "game", "name") SELECT "id", "updated_at", "created_at", "deleted_at", "level", "type", 'turbo', printf('%03d', "number") FROM `tracks`;--> statement-breakpoint
DROP TABLE `tracks`;--> statement-breakpoint
ALTER TABLE `__new_tracks` RENAME TO `tracks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `tracks_uid_unique` ON `tracks` (`uid`);
