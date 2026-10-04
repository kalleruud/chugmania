CREATE UNIQUE INDEX `tournament_group_position` ON `tournament_groups` (`tournament`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `tournament_match_order` ON `tournament_matches` (`tournament`,`order`) WHERE "tournament_matches"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `tournament_stage` ON `tournament_stages` (`tournament`,`stage`);