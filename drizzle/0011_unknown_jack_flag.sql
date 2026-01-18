PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_stages` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`tournament` text NOT NULL,
	`bracket` text,
	`level` text,
	`index` integer NOT NULL,
	FOREIGN KEY (`tournament`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_stages`("id", "updated_at", "created_at", "deleted_at", "tournament", "bracket", "index") SELECT "id", "updated_at", "created_at", "deleted_at", "tournament", "bracket", "index" FROM `stages`;--> statement-breakpoint
DROP TABLE `stages`;--> statement-breakpoint
ALTER TABLE `__new_stages` RENAME TO `stages`;--> statement-breakpoint
PRAGMA foreign_keys=ON;