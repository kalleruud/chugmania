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
UPDATE `session_signups` SET `response` = 'maybe', `deleted_at` = NULL WHERE `session` IN (SELECT `id` FROM `sessions` WHERE `date_voting_closed` = false AND `date_options` IS NOT NULL AND `date_options` != '[]') AND (`deleted_at` IS NULL OR EXISTS (SELECT 1 FROM `session_date_votes` v WHERE v.`session` = `session_signups`.`session` AND v.`user` = `session_signups`.`user`));--> statement-breakpoint
INSERT INTO `session_signups` (`id`, `created_at`, `session`, `user`, `response`) SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), unixepoch() * 1000, v.`session`, v.`user`, 'maybe' FROM `session_date_votes` v JOIN `sessions` s ON s.`id` = v.`session` WHERE s.`date_voting_closed` = false AND s.`date_options` IS NOT NULL AND s.`date_options` != '[]' AND NOT EXISTS (SELECT 1 FROM `session_signups` x WHERE x.`session` = v.`session` AND x.`user` = v.`user`);--> statement-breakpoint
UPDATE `sessions` SET `date` = NULL WHERE `date_voting_closed` = false AND `date_options` IS NOT NULL AND `date_options` != '[]';
