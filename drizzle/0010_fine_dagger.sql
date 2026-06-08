CREATE TABLE `unconfirmed_laps` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`session` text NOT NULL,
	`track` text NOT NULL,
	`heat_id` text NOT NULL,
	`slot` integer NOT NULL,
	`duration_ms` integer NOT NULL,
	`player_count` integer NOT NULL,
	FOREIGN KEY (`session`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`track`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`number` integer,
	`level` text,
	`type` text,
	`map_uid` text,
	`name` text,
	`author` text
);
--> statement-breakpoint
INSERT INTO `__new_tracks`("id", "updated_at", "created_at", "deleted_at", "number", "level", "type", "map_uid", "name", "author") SELECT "id", "updated_at", "created_at", "deleted_at", "number", "level", "type", "map_uid", "name", "author" FROM `tracks`;--> statement-breakpoint
DROP TABLE `tracks`;--> statement-breakpoint
ALTER TABLE `__new_tracks` RENAME TO `tracks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `tracks_map_uid_unique` ON `tracks` (`map_uid`);--> statement-breakpoint
ALTER TABLE `time_entries` ADD `source` text NOT NULL;