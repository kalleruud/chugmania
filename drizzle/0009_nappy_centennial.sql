PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tournament_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`tournament` text NOT NULL,
	`name` text NOT NULL,
	`bracket` text NOT NULL,
	`round` integer,
	`match` text,
	`track` text,
	`completed_at` integer,
	`source_group_a` text,
	`source_group_a_rank` integer,
	`source_group_b` text,
	`source_group_b_rank` integer,
	`source_match_a` text,
	`source_match_a_progression` text,
	`source_match_b` text,
	`source_match_b_progression` text,
	FOREIGN KEY (`tournament`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`match`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`track`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_group_a`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_group_b`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_tournament_matches`("id", "updated_at", "created_at", "deleted_at", "tournament", "name", "bracket", "round", "match", "track", "completed_at", "source_group_a", "source_group_a_rank", "source_group_b", "source_group_b_rank", "source_match_a", "source_match_a_progression", "source_match_b", "source_match_b_progression") SELECT "id", "updated_at", "created_at", "deleted_at", "tournament", "name", "bracket", "round", "match", "track", "completed_at", "source_group_a", "source_group_a_rank", "source_group_b", "source_group_b_rank", "source_match_a", "source_match_a_progression", "source_match_b", "source_match_b_progression" FROM `tournament_matches`;--> statement-breakpoint
DROP TABLE `tournament_matches`;--> statement-breakpoint
ALTER TABLE `__new_tournament_matches` RENAME TO `tournament_matches`;--> statement-breakpoint
PRAGMA foreign_keys=ON;