CREATE TABLE `group_players` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`group` text NOT NULL,
	`user` text NOT NULL,
	`seed` integer NOT NULL,
	FOREIGN KEY (`group`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`tournament` text NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`tournament`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tournament_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`tournament` text NOT NULL,
	`name` text NOT NULL,
	`bracket` text NOT NULL,
	`round` integer NOT NULL,
	`match` text,
	`completed_at` integer,
	`source_group_a` text,
	`source_group_a_rank` integer,
	`source_group_b` text,
	`source_group_b_rank` integer,
	`source_match_a` text,
	`source_match_a_progression` text,
	`source_match_b` text,
	`source_match_b_progression` text,
	FOREIGN KEY (`tournament`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`match`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_group_a`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_group_b`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_match_a`) REFERENCES `tournament_matches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_match_b`) REFERENCES `tournament_matches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tournaments` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`session` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`groups_count` integer NOT NULL,
	`advancement_count` integer NOT NULL,
	`elimination_type` text NOT NULL,
	FOREIGN KEY (`session`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
