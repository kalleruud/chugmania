ALTER TABLE `sessions` ADD `status` text NOT NULL DEFAULT 'confirmed';--> statement-breakpoint
UPDATE `sessions` SET `status` = 'confirmed' WHERE `status` IS NULL;