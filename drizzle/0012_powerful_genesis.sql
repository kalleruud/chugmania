DROP TABLE `tournament_matches`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_match_dependencies` (
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
INSERT INTO `__new_match_dependencies`("id", "updated_at", "created_at", "deleted_at", "from_match", "from_group", "to_match", "from_position", "to_slot") SELECT "id", "updated_at", "created_at", "deleted_at", "from_match", "from_group", "to_match", "from_position", "to_slot" FROM `match_dependencies`;--> statement-breakpoint
DROP TABLE `match_dependencies`;--> statement-breakpoint
ALTER TABLE `__new_match_dependencies` RENAME TO `match_dependencies`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `matches` ADD `completed_at` integer;--> statement-breakpoint
ALTER TABLE `matches` ADD `index` integer;--> statement-breakpoint
ALTER TABLE `matches` ADD `stage` text REFERENCES stages(id);