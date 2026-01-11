-- Create new tables first
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
	FOREIGN KEY (`from_match`) REFERENCES `tournament_matches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_group`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_match`) REFERENCES `tournament_matches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `stages` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`tournament` text NOT NULL,
	`bracket` text NOT NULL,
	`index` integer NOT NULL,
	FOREIGN KEY (`tournament`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- Migrate matches table: rename user1->user_a, user2->user_b, convert winner from user ID to slot
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
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
	`comment` text,
	FOREIGN KEY (`user_a`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_b`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`track`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
-- Copy data from old matches table, converting winner user ID to 'A'/'B' slot
INSERT INTO `__new_matches`("id", "updated_at", "created_at", "deleted_at", "user_a", "user_b", "winner", "track", "session", "status", "duration_ms", "comment")
SELECT 
	"id", 
	"updated_at", 
	"created_at", 
	"deleted_at", 
	"user1" as "user_a", 
	"user2" as "user_b", 
	CASE 
		WHEN "winner" IS NULL THEN NULL
		WHEN "winner" = "user1" THEN 'A'
		WHEN "winner" = "user2" THEN 'B'
		ELSE NULL
	END as "winner",
	"track",
	"session", 
	"status", 
	"duration_ms", 
	"comment"
FROM `matches`;
--> statement-breakpoint
DROP TABLE `matches`;
--> statement-breakpoint
ALTER TABLE `__new_matches` RENAME TO `matches`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
-- Migrate tournament_matches table: simplify to just match, stage, index
-- First we need a stage for existing tournament matches
-- We'll create stages from existing tournament_matches brackets/rounds
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
-- Create stages from existing tournament_matches data
INSERT INTO `stages`("id", "created_at", "tournament", "bracket", "index")
SELECT DISTINCT
	lower(hex(randomblob(16))) as "id",
	strftime('%s', 'now') * 1000 as "created_at",
	"tournament",
	"bracket",
	COALESCE("round", 0) as "index"
FROM `tournament_matches`
WHERE "deleted_at" IS NULL;
--> statement-breakpoint
-- Create new tournament_matches table
CREATE TABLE `__new_tournament_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`match` text NOT NULL,
	`stage` text NOT NULL,
	`index` integer NOT NULL,
	FOREIGN KEY (`match`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`stage`) REFERENCES `stages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- Copy data, linking to created stages
INSERT INTO `__new_tournament_matches`("id", "updated_at", "created_at", "deleted_at", "match", "stage", "index")
SELECT 
	tm."id",
	tm."updated_at",
	tm."created_at",
	tm."deleted_at",
	COALESCE(tm."match", '') as "match",
	COALESCE(s."id", '') as "stage",
	0 as "index"
FROM `tournament_matches` tm
LEFT JOIN `stages` s ON s."tournament" = tm."tournament" AND s."bracket" = tm."bracket" AND s."index" = COALESCE(tm."round", 0);
--> statement-breakpoint
DROP TABLE `tournament_matches`;
--> statement-breakpoint
ALTER TABLE `__new_tournament_matches` RENAME TO `tournament_matches`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
-- Migrate groups table: add index column (using name as a temporary identifier)
-- Note: The name column was storing group letter (A, B, etc.), convert to index (0, 1, etc.)
ALTER TABLE `groups` ADD `index` integer;
--> statement-breakpoint
-- Set index based on name (A=0, B=1, etc.) or fallback to 0
UPDATE `groups` SET `index` = CASE
	WHEN "name" = 'A' THEN 0
	WHEN "name" = 'B' THEN 1
	WHEN "name" = 'C' THEN 2
	WHEN "name" = 'D' THEN 3
	WHEN "name" = 'E' THEN 4
	WHEN "name" = 'F' THEN 5
	WHEN "name" = 'G' THEN 6
	WHEN "name" = 'H' THEN 7
	ELSE 0
END;
--> statement-breakpoint
-- Recreate groups table without name column and with NOT NULL index
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`tournament` text NOT NULL,
	`index` integer NOT NULL,
	FOREIGN KEY (`tournament`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_groups`("id", "updated_at", "created_at", "deleted_at", "tournament", "index")
SELECT "id", "updated_at", "created_at", "deleted_at", "tournament", COALESCE("index", 0) FROM `groups`;
--> statement-breakpoint
DROP TABLE `groups`;
--> statement-breakpoint
ALTER TABLE `__new_groups` RENAME TO `groups`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
