ALTER TABLE `tournaments` ADD `status` text DEFAULT 'started' NOT NULL;--> statement-breakpoint
ALTER TABLE `tournaments` ADD `owner` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `tournaments` ADD `preview_visibility` text DEFAULT 'visible' NOT NULL;