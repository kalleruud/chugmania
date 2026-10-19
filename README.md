# Chugmania

Chugmania is a full-stack Trackmania Turbo companion for logging lap times, sharing leaderboards, planning meetups, and coordinating local sessions. The backend (Express + Socket.IO + Drizzle/SQLite) and the frontend (React + Vite) are bundled together and run via a single Vite Express server.

## Features

- Record lap times with optional session/context metadata and real-time Socket.IO updates
- Browse aggregated leaderboards, player profiles, and track stats from the shared SQLite database
- Plan meetups through the sessions module, including calendar exports and attendance tracking
- Soft-delete sessions with cascading deletion of signups (admin/moderator only)
- Centralized date formatting with Norwegian localization and relative dates
- Bulk-import users, tracks, and lap times through CSV uploads for quick seeding

## Tech Stack

- **Backend:** Node.js, Express 5, Socket.IO, Drizzle ORM (SQLite)
- **Frontend:** React 19, Vite, Tailwind Merge utilities, Lucide icons, shadcn/ui components (Calendar, Popover, etc.)
- **Tooling:** TypeScript (strict), tsup bundling, Prettier with organize-imports and Tailwind plugins

## Getting Started

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and populate required secrets (see **Configuration**).
3. Launch the dev server via `npm run dev`; visit the URL printed in the terminal for the app and API.
4. The first boot creates `data/db.sqlite`. Commit no database files—Drizzle migrations handle schema.
5. There are no default login credentials. On a fresh database, the login page shows only `Registrer`; enter the email and password you want for the first admin user.
6. Chugmania automatically gives the first registered user the `admin` role. After that, use `Logg inn` with the same email and password. Additional users can be created or imported from `/admin`.

## Scripts

| Command                         | Description                                               |
| ------------------------------- | --------------------------------------------------------- |
| `npm run dev`                   | Boot backend + frontend with hot reload on `PORT`.        |
| `npm run build`                 | Produce production bundles in `dist/` and `dist/server/`. |
| `npm run build:frontend`        | Build the Vite client only.                               |
| `npm run build:backend`         | Bundle the Express server via tsup.                       |
| `npm run start`                 | Apply migrations then serve the built app.                |
| `npm run prod`                  | Serve the built backend without running migrations.       |
| `npm run check`                 | Run `drizzle-kit check`, TypeScript, and Prettier.        |
| `npm run db:gen`                | Emit SQL migrations after schema edits.                   |
| `npm run db:push` / `db:studio` | Push schema OR open the Drizzle Studio UI.                |

### Testing

Run `npm test` for Bun integration tests against a migrated in-memory SQLite database. The original tests are retained unchanged and still expect the legacy numbered-track model; they need updating before they can pass against the current name/game track schema.

## Project Layout

```
backend/    Express server, Socket.IO, database layer, managers
common/     Shared TypeScript models and utilities (date formatting, validation)
frontend/   React app components, pages, contexts, and styling
data/       Local SQLite database (created automatically, ignored by Git)
```

Key backend flows live under `backend/src/managers/`, while shared DTOs reside in `common/models/`. Frontend routes sit in `frontend/app/pages/` and reuse components from `frontend/components/`. Date formatting utilities are centralized in `common/utils/date.ts` with Norwegian localization and relative date display.

## CSV Import/Export

Admins can visit `/admin` to upload and download CSV files for all database tables. Supported tables: `users`, `tracks`, `sessions`, `timeEntries`, and `sessionSignups`. Each upload reports created and updated row counts to confirm the data outcome. Ensure the column order matches the exported format. When adding new database tables, update `AdminManager` in `backend/src/managers/admin.manager.ts` to include them in the `TABLE_MAP` and `EXCLUDED_COL_EXPORT` configuration.

## Trackmania webhook drafts

Configure the plugin endpoint as `https://<your-host>/api/webhook` and set its authentication token to the server's `TRACKMANIA_WEBHOOK_TOKEN`. An empty server token disables ingestion. Both Trackmania Turbo and Next use the plugin's schema 1.x contract; all seven event types and their matching event headers are required. Bodies are limited to 256 KB.

Incoming captures are linked to the closest session that has already started today or yesterday in Europe/Oslo. Cancelled and deleted sessions do not qualify. The chosen session stays fixed; new events stop being accepted when it no longer qualifies. Identical retries are acknowledged even if the session has since expired.

The receiver stores captures and original events privately on the backend. The client API exposes only derived lap-time and match drafts through authenticated `get_result_drafts` (`{ session }`) and `all_result_drafts`. Both use the same `{ timeEntries, matches }` projection. These contain result fields, database IDs, assignments, track/session references, and derived finish/chug durations. They exclude capture/game IDs, raw events, captured player identities, plugin metadata, map snapshots, and webhook sequence details. There is no webhook UI or raw-event retrieval API.

Draft actions use `{ kind: 'lap' | 'match', id }` with a result row ID: `claim_result_draft`, `assign_result_draft`, `edit_result_draft_times`, `select_result_draft_track`, `create_result_draft_track`, `publish_result_draft`, and `discard_result_draft`. Participant claims and corrections remain restricted to their own slot; moderator assignments, track selection, and discard require an admin or moderator. Publication still validates a complete capture, assigned active users, track, and positive finish result. Missing chug durations stay null; zero is valid. One finisher beats a DNF, ties stay unpublished, and matches publish as standalone session results. Drafts remain excluded from published results, ratings, statistics, signups, and tournament progression.

Tracks retain their required name, string type, Next/Turbo game, and map metadata. Legacy numbers migrate to names padded to three digits. The restored UI uses the current name/type fields without webhook-specific screens or metadata cards. Manual draft track selection and creation copy map metadata into the normal track model for future matching, without exposing the original event.

`WEBHOOK_DRAFT_RETENTION_DAYS` defaults to 7 and must be positive. Cleanup runs on startup and hourly, removing unpublished captures, events, and draft rows based on first receipt, including discarded and partial captures. Published captures and events remain available permanently, including after their result is soft-deleted. Capture links remain private to backend storage and are masked on ordinary result responses.

CSV requests cannot import or export webhook captures or events, and result exports omit capture links. Back up and restore the SQLite database directly to preserve private webhook history.
