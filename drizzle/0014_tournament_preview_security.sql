ALTER TABLE `tournaments` ADD `owner` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `tournaments` ADD `preview_visibility` text DEFAULT 'visible' NOT NULL;