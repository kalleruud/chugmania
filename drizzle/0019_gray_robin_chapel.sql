CREATE TABLE `session_date_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`session` text NOT NULL,
	`user` text NOT NULL,
	`dates` text NOT NULL,
	FOREIGN KEY (`session`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_date_vote` ON `session_date_votes` (`session`,`user`);--> statement-breakpoint
ALTER TABLE `sessions` ADD `date_options` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `date_voting_closed` integer DEFAULT false NOT NULL;