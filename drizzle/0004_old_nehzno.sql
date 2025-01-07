CREATE TABLE `group_users` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`user` text NOT NULL,
	`group` text NOT NULL,
	FOREIGN KEY (`user`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`name` text NOT NULL,
	`session` text NOT NULL,
	FOREIGN KEY (`session`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`user_1` text NOT NULL,
	`user_2` text NOT NULL,
	`winner` text,
	`track` text NOT NULL,
	`session` text NOT NULL,
	`amount_l` integer NOT NULL,
	`comment` text,
	FOREIGN KEY (`user_1`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_2`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`winner`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`track`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `groups_name_unique` ON `groups` (`name`);