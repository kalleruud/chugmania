CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`description` text,
	`date` integer NOT NULL,
	`type` text NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `time_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`user` text NOT NULL,
	`track` text NOT NULL,
	`session` text NOT NULL,
	`duration_ms` integer NOT NULL,
	`amount_l` integer NOT NULL,
	`comment` text,
	FOREIGN KEY (`user`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`track`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`number` integer NOT NULL,
	`level` text NOT NULL,
	`type` text NOT NULL,
	`is_chuggable` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password` blob NOT NULL,
	`is_admin` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);