CREATE TABLE `match_dependencies` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`from_match` text,
	`from_group` text,
	`to_match` text NOT NULL,
	`from_position` integer NOT NULL,
	`to_slot` text NOT NULL,
	FOREIGN KEY (`from_match`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_group`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_match`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `stages` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`tournament` text NOT NULL,
	`bracket` text,
	`level` text,
	`index` integer NOT NULL,
	FOREIGN KEY (`tournament`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
DROP TABLE `tournament_matches`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`user_a` text,
	`user_b` text,
	`winner` text,
	`track` text,
	`session` text,
	`status` text NOT NULL,
	`duration_ms` integer,
	`completed_at` integer,
	`comment` text,
	`index` integer,
	`stage` text,
	FOREIGN KEY (`user_a`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_b`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`track`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`stage`) REFERENCES `stages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_matches`("id", "updated_at", "created_at", "deleted_at", "user_a", "user_b", "winner", "track", "session", "status", "duration_ms", "completed_at", "comment", "index", "stage") SELECT "id", "updated_at", "created_at", "deleted_at", "user_a", "user_b", "winner", "track", "session", "status", "duration_ms", "completed_at", "comment", "index", "stage" FROM `matches`;--> statement-breakpoint
DROP TABLE `matches`;--> statement-breakpoint
ALTER TABLE `__new_matches` RENAME TO `matches`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_tournaments` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`session` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`groups_count` integer NOT NULL,
	`advancement_count` integer NOT NULL,
	`elimination_type` text NOT NULL,
	FOREIGN KEY (`session`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_tournaments`("id", "updated_at", "created_at", "deleted_at", "session", "name", "description", "groups_count", "advancement_count", "elimination_type") SELECT "id", "updated_at", "created_at", "deleted_at", "session", "name", "description", "groups_count", "advancement_count", "elimination_type" FROM `tournaments`;--> statement-breakpoint
DROP TABLE `tournaments`;--> statement-breakpoint
ALTER TABLE `__new_tournaments` RENAME TO `tournaments`;--> statement-breakpoint
ALTER TABLE `groups` ADD `index` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `groups` DROP COLUMN `name`;