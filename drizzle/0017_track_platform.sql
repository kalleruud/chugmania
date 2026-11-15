ALTER TABLE `tracks` ADD `platform` text;--> statement-breakpoint
UPDATE `tracks` SET `platform` = 'ps4' WHERE `level` = 'custom';
