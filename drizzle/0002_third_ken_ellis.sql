ALTER TABLE `users` ADD `short_name` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_short_name_unique` ON `users` (`short_name`);