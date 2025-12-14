PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_session_signups` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`session` text NOT NULL,
	`user` text NOT NULL,
	`response` text NOT NULL,
	FOREIGN KEY (`session`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_session_signups`("id", "updated_at", "created_at", "deleted_at", "session", "user", "response") SELECT "id", "updated_at", "created_at", "deleted_at", "session", "user", "response" FROM `session_signups`;--> statement-breakpoint
DROP TABLE `session_signups`;--> statement-breakpoint
ALTER TABLE `__new_session_signups` RENAME TO `session_signups`;--> statement-breakpoint
PRAGMA foreign_keys=ON;