CREATE TABLE `api_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`user` text NOT NULL,
	`name` text NOT NULL,
	`expires_at` integer,
	`last_used_at` integer,
	FOREIGN KEY (`user`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `active_api_token_name` ON `api_tokens` (`user`,`name`) WHERE "api_tokens"."deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE `webhook_captures` ADD `user` text REFERENCES users(id);