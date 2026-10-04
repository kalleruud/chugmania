ALTER TABLE `tournament_groups` ADD `position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
WITH positions AS (
	SELECT id, row_number() OVER (
		PARTITION BY tournament ORDER BY deleted_at IS NOT NULL, rowid
	) - 1 AS position FROM tournament_groups
)
UPDATE tournament_groups SET position = (
	SELECT position FROM positions WHERE positions.id = tournament_groups.id
);--> statement-breakpoint
ALTER TABLE `tournament_players` DROP COLUMN `duration`;--> statement-breakpoint
ALTER TABLE `tournament_players` DROP COLUMN `source_entry`;--> statement-breakpoint
ALTER TABLE `tournaments` DROP COLUMN `admission_closed_at`;--> statement-breakpoint
UPDATE tournaments SET config = json_remove(config, '$.session');
