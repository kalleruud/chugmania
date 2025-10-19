ALTER TABLE `time_entries` ADD `session` text REFERENCES sessions(id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `session_signups` (
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`session` text NOT NULL,
	`user` text NOT NULL,
	PRIMARY KEY(`session`, `user`),
	FOREIGN KEY (`session`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`name` text NOT NULL,
	`description` text,
	`date` integer NOT NULL,
	`location` text
);
