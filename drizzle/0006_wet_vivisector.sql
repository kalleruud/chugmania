ALTER TABLE time_entries DROP COLUMN amount_l;
--> statement-breakpoint
ALTER TABLE time_entries ADD COLUMN amount_l REAL NOT NULL DEFAULT 0.5;
--> statement-breakpoint
ALTER TABLE matches DROP COLUMN amount_l;
--> statement-breakpoint
ALTER TABLE matches ADD COLUMN amount_l REAL NOT NULL DEFAULT 0.5;