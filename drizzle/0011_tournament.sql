CREATE TABLE `tournament_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`tournament` text NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`tournament`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tournament_group_position` ON `tournament_groups` (`tournament`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `tournament_group_owner` ON `tournament_groups` (`tournament`,`id`);--> statement-breakpoint
CREATE TABLE `tournament_match_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`tournament_match` text NOT NULL,
	`position` integer NOT NULL,
	`kind` text NOT NULL,
	`slot_holder_id` text NOT NULL,
	`rank` integer,
	`override_user` text,
	FOREIGN KEY (`tournament_match`) REFERENCES `tournament_matches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`override_user`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "tournament_slot_position" CHECK("tournament_match_slots"."position" IN (1, 2)),
	CONSTRAINT "tournament_slot_kind" CHECK("tournament_match_slots"."kind" IN ('player', 'group_rank', 'match_winner', 'match_loser')),
	CONSTRAINT "tournament_slot_rank" CHECK(("tournament_match_slots"."kind" = 'group_rank' AND "tournament_match_slots"."rank" IS NOT NULL AND "tournament_match_slots"."rank" > 0) OR ("tournament_match_slots"."kind" != 'group_rank' AND "tournament_match_slots"."rank" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tournament_match_slot_position` ON `tournament_match_slots` (`tournament_match`,`position`);--> statement-breakpoint
CREATE INDEX `tournament_slot_holder` ON `tournament_match_slots` (`kind`,`slot_holder_id`);--> statement-breakpoint
CREATE TABLE `tournament_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`tournament` text NOT NULL,
	`match_id` text NOT NULL,
	`group_id` text,
	`bracket` text NOT NULL,
	`round` integer NOT NULL,
	`order` integer NOT NULL,
	FOREIGN KEY (`tournament`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tournament`,`group_id`) REFERENCES `tournament_groups`(`tournament`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "tournament_match_bracket" CHECK("tournament_matches"."bracket" IN ('group', 'upper', 'lower', 'final'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tournament_match_record` ON `tournament_matches` (`match_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tournament_match_order` ON `tournament_matches` (`tournament`,`order`) WHERE "tournament_matches"."deleted_at" IS NULL;--> statement-breakpoint
CREATE TABLE `tournament_players` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`tournament` text NOT NULL,
	`user` text NOT NULL,
	`group_id` text NOT NULL,
	`admission` integer NOT NULL,
	`rating` integer NOT NULL,
	FOREIGN KEY (`tournament`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tournament`,`group_id`) REFERENCES `tournament_groups`(`tournament`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tournament_participant` ON `tournament_players` (`tournament`,`user`);--> statement-breakpoint
CREATE TABLE `tournament_stages` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`tournament` text NOT NULL,
	`stage` text NOT NULL,
	`tracks` text NOT NULL,
	FOREIGN KEY (`tournament`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tournament_stage` ON `tournament_stages` (`tournament`,`stage`);--> statement-breakpoint
CREATE TABLE `tournaments` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`session` text NOT NULL,
	`groups_count` integer DEFAULT 1 NOT NULL,
	`advancement_count` integer DEFAULT 2 NOT NULL,
	`elimination_type` text DEFAULT 'single' NOT NULL,
	`frozen_at` integer,
	`not_ready_reason` text,
	FOREIGN KEY (`session`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `active_session_tournament` ON `tournaments` (`session`) WHERE "tournaments"."deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE `time_entries` ADD `draft` integer DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE TRIGGER tournament_match_session_insert
BEFORE INSERT ON tournament_matches
WHEN NEW.deleted_at IS NULL AND EXISTS (
	SELECT 1 FROM tournaments t JOIN matches m ON m.id = NEW.match_id
	WHERE t.id = NEW.tournament AND t.deleted_at IS NULL AND m.session IS NOT t.session
)
BEGIN
	SELECT RAISE(ABORT, 'Tournament match must belong to the tournament session');
END;
--> statement-breakpoint
CREATE TRIGGER tournament_match_session_update
BEFORE UPDATE OF tournament, match_id, deleted_at ON tournament_matches
WHEN NEW.deleted_at IS NULL AND EXISTS (
	SELECT 1 FROM tournaments t JOIN matches m ON m.id = NEW.match_id
	WHERE t.id = NEW.tournament AND t.deleted_at IS NULL AND m.session IS NOT t.session
)
BEGIN
	SELECT RAISE(ABORT, 'Tournament match must belong to the tournament session');
END;
--> statement-breakpoint
CREATE TRIGGER tournament_linked_match_session_update
BEFORE UPDATE OF session ON matches
WHEN NEW.session IS NOT OLD.session AND EXISTS (
	SELECT 1 FROM tournament_matches f JOIN tournaments t ON t.id = f.tournament
	WHERE f.match_id = NEW.id AND f.deleted_at IS NULL AND t.deleted_at IS NULL
		AND NEW.session IS NOT t.session
)
BEGIN
	SELECT RAISE(ABORT, 'Tournament match must belong to the tournament session');
END;
--> statement-breakpoint
CREATE TRIGGER tournament_session_update
BEFORE UPDATE OF session, deleted_at ON tournaments
WHEN NEW.deleted_at IS NULL AND (NEW.session IS NOT OLD.session OR OLD.deleted_at IS NOT NULL)
	AND EXISTS (
		SELECT 1 FROM tournament_matches f JOIN matches m ON m.id = f.match_id
		WHERE f.tournament = NEW.id AND f.deleted_at IS NULL AND m.session IS NOT NEW.session
	)
BEGIN
	SELECT RAISE(ABORT, 'Tournament match must belong to the tournament session');
END;
