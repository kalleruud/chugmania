PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`name` text NOT NULL,
	`description` text,
	`date` integer,
	`location` text,
	`status` text NOT NULL,
	`date_options` text,
	`date_voting_closed` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_sessions`("id", "updated_at", "created_at", "deleted_at", "name", "description", "date", "location", "status", "date_options", "date_voting_closed") SELECT "id", "updated_at", "created_at", "deleted_at", "name", "description", "date", "location", "status", "date_options", "date_voting_closed" FROM `sessions`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE `__new_sessions` RENAME TO `sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
UPDATE `sessions` SET `date_voting_closed` = true WHERE `date_voting_closed` = false AND `date_options` IS NOT NULL AND (`status` != 'tentative' OR `date` <= unixepoch() * 1000);--> statement-breakpoint
UPDATE `session_signups` SET `deleted_at` = (unixepoch() * 1000) WHERE `deleted_at` IS NULL AND `session` IN (SELECT `id` FROM `sessions` WHERE `date_voting_closed` = false AND `date_options` IS NOT NULL AND `date_options` != '[]');--> statement-breakpoint
UPDATE `sessions` SET `date` = NULL WHERE `date_voting_closed` = false AND `date_options` IS NOT NULL AND `date_options` != '[]';
