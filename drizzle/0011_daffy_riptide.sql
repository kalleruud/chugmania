ALTER TABLE `group_players` ADD `totalMatches` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `group_players` ADD `wins` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `group_players` ADD `losses` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `groups` ADD `number` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `groups` DROP COLUMN `name`;