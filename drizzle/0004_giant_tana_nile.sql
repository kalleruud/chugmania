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
INSERT INTO `__new_session_signups`("id", "updated_at", "created_at", "deleted_at", "session", "user", "response") 
WITH uuid_gen AS (
  SELECT 
    session,
    user,
    response,
    updated_at,
    created_at,
    deleted_at,
    lower(
      substr(hex(randomblob(4)), 1, 8) || '-' ||
      substr(hex(randomblob(2)), 1, 4) || '-' ||
      '4' || substr(hex(randomblob(2)), 1, 3) || '-' ||
      printf('%x', 8 + (abs(random()) % 4)) || substr(hex(randomblob(2)), 1, 3) || '-' ||
      substr(hex(randomblob(6)), 1, 12)
    ) as id
  FROM `session_signups`
)
SELECT id, updated_at, created_at, deleted_at, session, user, response FROM uuid_gen;--> statement-breakpoint
DROP TABLE `session_signups`;--> statement-breakpoint
ALTER TABLE `__new_session_signups` RENAME TO `session_signups`;--> statement-breakpoint
PRAGMA foreign_keys=ON;