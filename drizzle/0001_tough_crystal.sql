PRAGMA foreign_keys=off;
--> statement-breakpoint
ALTER TABLE sessions RENAME TO _sessions_old;
--> statement-breakpoint
CREATE TABLE sessions (
	id text PRIMARY KEY NOT NULL,
	updated_at integer NOT NULL,
	created_at integer NOT NULL,
	deleted_at integer,
	description text,
	date string NOT NULL,
	type text NOT NULL,
	created_by text NOT NULL,
	FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO sessions (id, updated_at, created_at, deleted_at, description, type, created_by)
  SELECT id, updated_at, created_at, deleted_at, description, type, created_by
  FROM _sessions_old;
--> statement-breakpoint
PRAGMA foreign_keys=on;