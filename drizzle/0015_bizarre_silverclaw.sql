DROP TRIGGER tournament_match_session_insert;--> statement-breakpoint
DROP TRIGGER tournament_match_session_update;--> statement-breakpoint
DROP TRIGGER tournament_linked_match_session_update;--> statement-breakpoint
DROP TRIGGER tournament_session_update;--> statement-breakpoint
CREATE TABLE `__new_tournament_matches` (
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
	`slot1` text NOT NULL,
	`slot2` text NOT NULL,
	`reset` text DEFAULT 'none' NOT NULL,
	FOREIGN KEY (`tournament`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tournament`,`group_id`) REFERENCES `tournament_groups`(`tournament`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "tournament_match_bracket" CHECK("__new_tournament_matches"."bracket" IN ('group', 'upper', 'lower', 'final')),
	CONSTRAINT "tournament_match_reset" CHECK("__new_tournament_matches"."reset" IN ('none', 'conditional', 'required', 'unneeded'))
);--> statement-breakpoint
INSERT INTO `__new_tournament_matches`("id", "updated_at", "created_at", "deleted_at", "tournament", "match_id", "group_id", "bracket", "round", "order", "slot1", "slot2", "reset") SELECT "id", "updated_at", "created_at", "deleted_at", "tournament", "match_id", "group_id", "bracket", "round", "order", "slot1", "slot2", "reset" FROM `tournament_matches`;--> statement-breakpoint
DROP TABLE `tournament_matches`;--> statement-breakpoint
ALTER TABLE `__new_tournament_matches` RENAME TO `tournament_matches`;--> statement-breakpoint
CREATE UNIQUE INDEX `tournament_match_record` ON `tournament_matches` (`match_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tournament_match_order` ON `tournament_matches` (`tournament`,`order`) WHERE "tournament_matches"."deleted_at" IS NULL;--> statement-breakpoint
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

