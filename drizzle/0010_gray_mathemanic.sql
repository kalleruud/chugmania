ALTER TABLE `tournament_matches` ADD `group` text REFERENCES groups(id);--> statement-breakpoint
ALTER TABLE `tournament_matches` ADD `stage` text;--> statement-breakpoint
ALTER TABLE `tournament_matches` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tournaments` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`session` text NOT NULL REFERENCES sessions(id) ON DELETE cascade,
	`qualification_track` text NOT NULL REFERENCES tracks(id),
	`name` text NOT NULL,
	`description` text,
	`groups_count` integer DEFAULT 2 NOT NULL,
	`advancement_count` integer DEFAULT 2 NOT NULL,
	`elimination_type` text DEFAULT 'single' NOT NULL
);--> statement-breakpoint
INSERT INTO `__new_tournaments` (
	`id`,
	`updated_at`,
	`created_at`,
	`deleted_at`,
	`session`,
	`qualification_track`,
	`name`,
	`description`,
	`groups_count`,
	`advancement_count`,
	`elimination_type`
)
SELECT
	`t`.`id`,
	`t`.`updated_at`,
	`t`.`created_at`,
	`t`.`deleted_at`,
	`t`.`session`,
	COALESCE(
		(
			SELECT `tm`.`track`
			FROM `tournament_matches` `tm`
			WHERE `tm`.`tournament` = `t`.`id`
				AND `tm`.`track` IS NOT NULL
			ORDER BY `tm`.`sort_order`, `tm`.`created_at`
			LIMIT 1
		),
		(
			SELECT `tr`.`id`
			FROM `tracks` `tr`
			ORDER BY `tr`.`created_at`
			LIMIT 1
		)
	),
	`t`.`name`,
	`t`.`description`,
	`t`.`groups_count`,
	`t`.`advancement_count`,
	`t`.`elimination_type`
FROM `tournaments` `t`;--> statement-breakpoint
DROP TABLE `tournaments`;--> statement-breakpoint
ALTER TABLE `__new_tournaments` RENAME TO `tournaments`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
