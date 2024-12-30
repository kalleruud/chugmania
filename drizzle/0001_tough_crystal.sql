PRAGMA foreign_keys=OFF;
--> statement-breakpoint
ALTER TABLE sessions DROP COLUMN date
--> statement-breakpoint
ALTER TABLE sessions ADD COLUMN date text NOT NULL;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
