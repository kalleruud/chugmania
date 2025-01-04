ALTER TABLE `users` ADD `role` text NOT NULL DEFAULT 'user';
--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `is_admin`;