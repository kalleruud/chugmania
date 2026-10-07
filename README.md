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

Run `npm test` for Bun integration tests against a migrated in-memory SQLite database. Use `npm test -- tests/webhooks.test.ts` for the sequential Turbo and Next webhook replay tests, which start a temporary localhost HTTP receiver.

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

Review drafts on the Session page. Users can claim or release their own slot; admins and moderators can assign users, select a track, create a named track from map metadata, or discard a capture. Map auto-matching uses UID only. Publication requires all assigned players, a track, a complete sequence from start through end, and a positive finish result. Missing chug times remain empty, one finisher beats a DNF, and ties stay unpublished. Any end reason can publish a valid result. Drafts contribute no results, rankings, statistics, or signups until published; webhook matches publish as standalone session matches.

The receiver returns `204` for accepted events and identical retries, `400` for invalid JSON/payloads/headers, `401` for missing or invalid credentials, `409` for conflicting event/game metadata, `413` for oversized bodies, and `503` with `NO_ACTIVE_SESSION` when no qualifying session exists. Server persistence failures return `500`; the plugin retries transient failures.

`WEBHOOK_DRAFT_RETENTION_DAYS` defaults to 7 and must be positive. Cleanup runs on startup and hourly, removing unpublished captures, events, and draft rows based on first receipt, including discarded and partial captures. Published captures and events remain available permanently, including after their result is soft-deleted. Published rows' `webhookCapture` values identify their source game; admins, moderators, and assigned participants can retrieve the original events using `get_webhook_events` with `{ gameId }`.

CSV exports include `webhookCaptures` and `webhookEvents`, timestamps, map metadata, and original payload text. Restore users, tracks, and sessions first, then captures, events, and result rows; restore tournament tables afterward in their foreign-key dependency order. Keep IDs and capture/result linkages intact when restoring.

## Sessions Module

The `/sessions` route shows upcoming and past events. Authorized users may create, edit, or delete sessions with optional locations and descriptions. Attendees can RSVP; ICS feeds are available via `/api/sessions/calendar.ics`, and individual invites can be downloaded per session. Session deletion is soft-delete (retained for audit), cascading to all signups, and only available to admin/moderator roles.

## Configuration

- `SECRET` (required): JWT signing key; use a strong random value.
- `TRACKMANIA_WEBHOOK_TOKEN` (optional): Shared bearer token for the Trackmania plugin; empty disables ingestion.
- `WEBHOOK_DRAFT_RETENTION_DAYS` (optional): Positive unpublished-capture retention in days; defaults to 7.
- `PORT` (optional): Server port. Defaults to `6996`; Codex worktrees generate a random `69xx` port.
- `ORIGIN` (required in production): Allowed frontend origin for CORS.
- `TOKEN_EXPIRY_H` (optional): Override default 1-hour auth token expiry.
- `VITE_ALLOW_SIGNUPS` (optional): Set to `true` to show the public `Registrer` button on the login page. Keep it `false` unless you intentionally want open registration.
- `.env.example` also exposes `SECRET` for local defaults—never commit secrets.

## Docker

- Build: `docker build -t chugmania .`
- Run: `docker run -p 6996:6996 -v ./data:/app/data --env-file .env chugmania`
- The entrypoint executes `npm start`, so migrations apply automatically before serving.
- Mount `/app/data` as a volume to persist the SQLite database across restarts.

## Contributing

Follow the coding conventions from `AGENTS.md`: Prettier formatting (2 spaces, single quotes, no semicolons), organize imports, explicit TypeScript types, and the shared `Result<T>` error-handling pattern. Reuse existing components and respect the Formula 1-inspired Tailwind design system to keep UI consistent.
