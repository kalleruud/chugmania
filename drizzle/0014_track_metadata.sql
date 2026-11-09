PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`level` text,
	`map_type` text,
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
INSERT INTO `__new_tracks`("id", "updated_at", "created_at", "deleted_at", "level", "environment", "game", "name") SELECT "id", "updated_at", "created_at", "deleted_at", "level", CASE "type" WHEN 'drift' THEN 'Canyon' WHEN 'valley' THEN 'Valley' WHEN 'lagoon' THEN 'Lagoon' WHEN 'stadium' THEN 'Stadium' ELSE "type" END, 'turbo', printf('%03d', "number") FROM `tracks`;--> statement-breakpoint
DROP TABLE `tracks`;--> statement-breakpoint
ALTER TABLE `__new_tracks` RENAME TO `tracks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `tracks_uid_unique` ON `tracks` (`uid`);

--> statement-breakpoint
UPDATE tracks SET map_type = 'Trackmania\Race', uid = 'rdClvxHy8JgOjrNrEbK4X5Jj7V', author = 'Nadeo', environment = 'Canyon', author_medal_ms = 33068, gold_medal_ms = 35126, silver_medal_ms = 40226, bronze_medal_ms = 51443, is_laps = 0, total_laps = NULL, checkpoints_per_lap = 3 WHERE game = 'turbo' AND level != 'custom' AND name = '001' AND uid IS NULL;
--> statement-breakpoint
UPDATE tracks SET map_type = 'Trackmania\Race', uid = '4pQoOddIpzHQdtVNLcK3tvNvbo7', author = 'Nadeo', environment = 'Canyon', author_medal_ms = 35598, gold_medal_ms = 38211, silver_medal_ms = 42980, bronze_medal_ms = 53837, is_laps = 0, total_laps = NULL, checkpoints_per_lap = 4 WHERE game = 'turbo' AND level != 'custom' AND name = '002' AND uid IS NULL;
--> statement-breakpoint
UPDATE tracks SET map_type = 'Trackmania\Race', uid = 'GxU3iOGT7Smt_Zs77TZoL8rCCa8', author = 'Nadeo', environment = 'Canyon', author_medal_ms = 28584, gold_medal_ms = 30425, silver_medal_ms = 34697, bronze_medal_ms = 43807, is_laps = 0, total_laps = NULL, checkpoints_per_lap = 4 WHERE game = 'turbo' AND level != 'custom' AND name = '003' AND uid IS NULL;
--> statement-breakpoint
UPDATE tracks SET map_type = 'TrackMania\Race', uid = '8sHSwzzzjNRUCH5w8T94sUfPZre', author = 'Nadeo', environment = 'Canyon', author_medal_ms = 26051, gold_medal_ms = 28325, silver_medal_ms = 31808, bronze_medal_ms = 40058, is_laps = 0, total_laps = NULL, checkpoints_per_lap = 3 WHERE game = 'turbo' AND level != 'custom' AND name = '004' AND uid IS NULL;
--> statement-breakpoint
UPDATE tracks SET map_type = 'Trackmania\Race', uid = '7HR4Rv5hCUnOtrtuKSmVy67bcJ0', author = 'Nadeo', environment = 'Canyon', author_medal_ms = 76750, gold_medal_ms = 81614, silver_medal_ms = 92565, bronze_medal_ms = 116815, is_laps = 1, total_laps = 3, checkpoints_per_lap = 3 WHERE game = 'turbo' AND level != 'custom' AND name = '005' AND uid IS NULL;
--> statement-breakpoint
UPDATE tracks SET map_type = 'TrackMania\Race', uid = '6Fy5gErdHMLqZLvHQj88L6XieVl', author = 'Nadeo', environment = 'Canyon', author_medal_ms = 74494, gold_medal_ms = 79976, silver_medal_ms = 89795, bronze_medal_ms = 112967, is_laps = 1, total_laps = 3, checkpoints_per_lap = 3 WHERE game = 'turbo' AND level != 'custom' AND name = '010' AND uid IS NULL;
--> statement-breakpoint
UPDATE tracks SET map_type = 'TrackMania\Race', uid = 's6L92Rb0swZ3Pp_URZybJu7OS6a', author = 'Nadeo', environment = 'Stadium', author_medal_ms = 59148, gold_medal_ms = 62720, silver_medal_ms = 70900, bronze_medal_ms = 87366, is_laps = 1, total_laps = 3, checkpoints_per_lap = 2 WHERE game = 'turbo' AND level != 'custom' AND name = '035' AND uid IS NULL;
--> statement-breakpoint
UPDATE tracks SET map_type = 'TrackMania\Race', uid = 'ktePhBgAaIRi5zle_D1tH9bF3el', author = 'Nadeo', environment = 'Stadium', author_medal_ms = 77138, gold_medal_ms = 82051, silver_medal_ms = 91793, bronze_medal_ms = 112292, is_laps = 1, total_laps = 3, checkpoints_per_lap = 6 WHERE game = 'turbo' AND level != 'custom' AND name = '040' AND uid IS NULL;
--> statement-breakpoint
UPDATE tracks SET map_type = 'Trackmania\Race', uid = 'rLLj3npQ1D1cEMXZWbfXISizwJ4', author = 'Nadeo', environment = 'Canyon', author_medal_ms = 127390, gold_medal_ms = 135371, silver_medal_ms = 153850, bronze_medal_ms = 193021, is_laps = 1, total_laps = 3, checkpoints_per_lap = 6 WHERE game = 'turbo' AND level != 'custom' AND name = '045' AND uid IS NULL;
--> statement-breakpoint
UPDATE tracks SET map_type = 'Trackmania\Race', uid = '2QTNxKnWoZAF7s_8_575laDM9X0', author = 'Nadeo', environment = 'Stadium', author_medal_ms = 107520, gold_medal_ms = 113566, silver_medal_ms = 127563, bronze_medal_ms = 153446, is_laps = 1, total_laps = 3, checkpoints_per_lap = 6 WHERE game = 'turbo' AND level != 'custom' AND name = '075' AND uid IS NULL;
--> statement-breakpoint
UPDATE tracks SET map_type = 'Trackmania\Race', uid = 'aF7sHBuQQJu4rlura8233lPeCS', author = 'Nadeo', environment = 'Canyon', author_medal_ms = 186427, gold_medal_ms = 213097, silver_medal_ms = 226774, bronze_medal_ms = 277562, is_laps = 1, total_laps = 3, checkpoints_per_lap = 10 WHERE game = 'turbo' AND level != 'custom' AND name = '090' AND uid IS NULL;
--> statement-breakpoint
UPDATE tracks SET map_type = 'Trackmania\Race', uid = 'Xs9DrZBjJRBJxB0u3A6r2oBZFI2', author = 'Nadeo', environment = 'Canyon', author_medal_ms = 187237, gold_medal_ms = 200648, silver_medal_ms = 227166, bronze_medal_ms = 283222, is_laps = 1, total_laps = 3, checkpoints_per_lap = 8 WHERE game = 'turbo' AND level != 'custom' AND name = '125' AND uid IS NULL;
--> statement-breakpoint
UPDATE tracks SET uid = 'j4IPjWI5yN7A0VM_Oj57xwFtBYh' WHERE game = 'turbo' AND level = 'custom' AND name = '004' AND uid IS NULL;
--> statement-breakpoint
UPDATE tracks SET uid = '3iEtUq8YUAagIU3N6joiGDWVsM6' WHERE game = 'turbo' AND level = 'custom' AND name = '005' AND uid IS NULL;
--> statement-breakpoint
UPDATE tracks SET uid = 'Ky_RhunmUnlngPFGNTt6iFtySYg' WHERE game = 'turbo' AND level = 'custom' AND name = '006' AND uid IS NULL;
--> statement-breakpoint
UPDATE tracks SET uid = 'UmHB7Vbmg_XlQ1DvZ8jyqj88Uq9' WHERE game = 'turbo' AND level = 'custom' AND name = '014' AND uid IS NULL;
