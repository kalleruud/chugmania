ALTER TABLE `tournament_matches` ADD `position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tournament_matches` ADD `group` text REFERENCES groups(id);--> statement-breakpoint
ALTER TABLE `tournament_matches` DROP COLUMN `name`;