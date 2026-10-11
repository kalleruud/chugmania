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
INSERT INTO `__new_tracks`("id", "updated_at", "created_at", "deleted_at", "level", "type", "game", "uid", "name", "author", "environment", "author_medal_ms", "gold_medal_ms", "silver_medal_ms", "bronze_medal_ms", "is_laps", "total_laps", "checkpoints_per_lap")
SELECT t."id", t."updated_at", t."created_at", t."deleted_at", t."level",
  COALESCE(NULLIF(t."map_type", ''), NULLIF(t."type", ''), 'unknown'),
  COALESCE((
    SELECT c."source_game" FROM "webhook_captures" c
    WHERE c."id" IN (
      SELECT "webhook_capture" FROM "time_entries" WHERE "track" = t."id"
      UNION
      SELECT "webhook_capture" FROM "matches" WHERE "track" = t."id"
    )
    ORDER BY c."created_at" DESC, c."id" ASC LIMIT 1
  ), 'turbo'),
  t."uid",
  CASE WHEN t."number" IS NOT NULL THEN CAST(t."number" AS TEXT)
    ELSE COALESCE(NULLIF(t."name", ''), 'Unnamed track') END,
  t."author", t."environment", t."author_medal_ms", t."gold_medal_ms", t."silver_medal_ms", t."bronze_medal_ms", t."is_laps", t."total_laps", t."checkpoints_per_lap"
FROM "tracks" t;--> statement-breakpoint
DROP TABLE `tracks`;--> statement-breakpoint
ALTER TABLE `__new_tracks` RENAME TO `tracks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `tracks_uid_unique` ON `tracks` (`uid`);