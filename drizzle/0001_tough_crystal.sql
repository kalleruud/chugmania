PRAGMA foreign_keys=off;

-- SESSIONS

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
DROP TABLE _sessions_old;
--> statement-breakpoint


-- TIME_ENTRIES

ALTER TABLE time_entries RENAME TO _time_entries_old;
--> statement-breakpoint
CREATE TABLE time_entries (
	id text PRIMARY KEY NOT NULL,
	updated_at integer NOT NULL,
	created_at integer NOT NULL,
	deleted_at integer,
	user text NOT NULL,
	track text NOT NULL,
	session text NOT NULL,
	duration_ms integer NOT NULL,
	amount_l integer NOT NULL,
	comment text,
	FOREIGN KEY (user) REFERENCES users(id) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (track) REFERENCES tracks(id) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (session) REFERENCES sessions(id) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO time_entries
  SELECT *
  FROM _time_entries_old;
--> statement-breakpoint
DROP TABLE _time_entries_old;
--> statement-breakpoint
PRAGMA foreign_keys=on;