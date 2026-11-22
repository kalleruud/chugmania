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

- **Backend:** Bun, Express 5, Socket.IO, Drizzle ORM (SQLite)
- **Frontend:** React 19, Vite, Tailwind Merge utilities, Lucide icons, shadcn/ui components (Calendar, Popover, etc.)
- **Tooling:** TypeScript (strict), Bun bundling, Prettier with organize-imports and Tailwind plugins

## Getting Started

1. Install Bun 1.4.4 and run `bun install --frozen-lockfile`.
2. Copy `.env.example` to `.env` and populate required secrets (see **Configuration**).
3. Launch the dev server via `bun run dev`; visit the URL printed in the terminal for the app and API.
4. The first boot creates `data/db.sqlite`. Commit no database files—Drizzle migrations handle schema.
5. In development (`NODE_ENV` is not `production`), startup creates a test admin if it does not exist. Log in with email `admin@chugmania.dev` and password `chugmania`. The app shows a `Development` label above the `+` button.
6. In production there are no default login credentials. On a fresh database, the login page shows only `Registrer`; the first registered user gets the `admin` role. Additional users can be created or imported from `/admin`.

## Scripts

| Command                         | Description                                               |
| ------------------------------- | --------------------------------------------------------- |
| `bun run dev`                   | Boot backend + frontend with hot reload on `PORT`.        |
| `bun run build`                 | Produce production bundles in `dist/` and `dist/server/`. |
| `bun run build:frontend`        | Build the Vite client only.                               |
| `bun run build:backend`         | Bundle the Express server via Bun.                        |
| `bun run start`                 | Apply migrations then serve the built app.                |
| `bun run check`                 | Run Drizzle, ESLint, TypeScript, and Prettier checks.     |
| `bun run db:gen`                | Emit SQL migrations after schema edits.                   |
| `bun run db:push` / `db:studio` | Push schema OR open the Drizzle Studio UI.                |

### Testing

Run the backend suite with `bun run test`, or pass a file such as `bun run test tests/tournament.test.ts`. To produce an LCOV report, run `bun run test --coverage --coverage-reporter=lcov`.

## Project Layout

```
backend/    Express server, Socket.IO, database layer, managers
common/     Shared TypeScript models and utilities (date formatting, validation)
frontend/   React app components, pages, contexts, and styling
data/       Local SQLite database (created automatically, ignored by Git)
```

Key backend flows live under `backend/src/managers/`, while shared DTOs reside in `common/models/`. Frontend routes sit in `frontend/app/pages/` and reuse components from `frontend/components/`. Date formatting utilities are centralized in `common/utils/date.ts` with Norwegian localization and relative date display.

## CSV Import/Export

Admins can visit `/admin` to upload and download CSV files for public application tables. Supported tables: `users`, `tracks`, `sessions`, `timeEntries`, and `sessionSignups`. Each upload reports created and updated row counts to confirm the data outcome. Ensure the column order matches the exported format. When adding new database tables, update `AdminManager` in `backend/src/managers/admin.manager.ts` to include them in the `TABLE_MAP` and `EXCLUDED_COL_EXPORT` configuration. Backend-private webhook captures, events, and result capture links are excluded; preserve them through SQLite database backups.

## Sessions Module

The `/sessions` route shows upcoming and past events. Authorized users may create, edit, or delete sessions with optional locations and descriptions. Attendees can RSVP; ICS feeds are available via `/api/sessions/calendar.ics`, and individual invites can be downloaded per session. Session deletion is soft-delete (retained for audit), cascading to all signups, and only available to admin/moderator roles.

## Configuration

- `SECRET` (required): JWT signing key; use a strong random value.
- `PORT` (optional): Server port. Defaults to `6996`; Codex worktrees generate a random `69xx` port.
- `ORIGIN` (required in production): Allowed frontend origin for CORS.
- `TOKEN_EXPIRY_H` (optional): Override default 1-hour auth token expiry.
- `ALLOW_SIGNUPS` (optional): Set to `true` in the server's runtime environment to enable the public `Registrer` button on the login page. It defaults to disabled. Recreate the container with the new environment to apply a change.
- `.env.example` also exposes `SECRET` for local defaults—never commit secrets.

## Docker

- Build: `docker build -t chugmania .`
- Run: `docker run -p 6996:6996 -v ./data:/app/data --env-file .env chugmania`
- The entrypoint executes `bun run start`, so migrations apply automatically before serving.
- Mount `/app/data` as a volume to persist the SQLite database across restarts. For a bind mount, give UID and GID 65534 (`nobody:nogroup`) write access to the host directory and all SQLite files.

## Contributing

Follow the coding conventions from `AGENTS.md`: Prettier formatting (2 spaces, single quotes, no semicolons), organize imports, explicit TypeScript types, and the shared `Result<T>` error-handling pattern. Reuse existing components and respect the Formula 1-inspired Tailwind design system to keep UI consistent.

## Trackmania webhook results

Configure the plugin endpoint as `https://<your-host>/api/webhook` with the server's `WEBHOOK_TOKEN` as its bearer token; an empty token disables ingestion. Captures attach to the latest session that started today or yesterday (Europe/Oslo). Raw events and capture metadata stay private to the backend. Planned result assignments are stored separately and excluded from CSV import and export.

A capture with a known map UID can reserve a planned lap or match with the same track and roster. Each driver’s name or login must match a unique active user's short name or full name (case-insensitive). When several eligible entries have that track and roster, the session’s **Nå** and **Neste** queue decides which one is first. A compatible moderator pin comes first, followed by ready tournament matches in fixture order, required tie-breaker laps, other tie-breaker laps, and standalone entries. Tie-breaker laps within each priority and standalone entries are ordered by oldest creation time, then ID.

The reserved row shows live timing. A contiguous capture ending normally with a positive finish time for every slot can complete that row automatically. Identical match times and incomplete captures remain available for manual resolution. Captures that cannot reserve an entry use the existing live row and draft flow. Moderators can still correct the result, and incoming timing preserves manual corrections. Back up the SQLite database to retain captures and their associations.
