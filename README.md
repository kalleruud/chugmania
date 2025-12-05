# Chugmania

Chugmania is a full-stack Trackmania Turbo companion for logging lap times, sharing leaderboards, planning meetups, and coordinating local sessions. The backend (Express + Socket.IO + Drizzle/SQLite) and the frontend (React + Vite) are bundled together and run via a single Vite Express server.

## Features

- Record lap times with optional session/context metadata and real-time Socket.IO updates
- Browse aggregated leaderboards, player profiles, and track stats from the shared SQLite database
- Plan meetups through the sessions module, including calendar exports and attendance tracking
- Bulk-import users, tracks, and lap times through CSV uploads for quick seeding

## Tech Stack

- **Backend:** Node.js, Express 5, Socket.IO, Drizzle ORM (SQLite)
- **Frontend:** React 19, Vite, Tailwind Merge utilities, Lucide icons, shadcn/ui components (Calendar, Popover, etc.)
- **Tooling:** TypeScript (strict), tsup bundling, Prettier with organize-imports and Tailwind plugins

## Getting Started

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and populate required secrets (see **Configuration**).
3. Launch the dev server via `npm run dev`; visit `http://localhost:6996` for the app and API.
4. The first boot creates `data/db.sqlite`. Commit no database files—Drizzle migrations handle schema.

## Scripts

| Command                         | Description                                               |
| ------------------------------- | --------------------------------------------------------- |
| `npm run dev`                   | Boot backend + frontend with hot reload (port 6996).      |
| `npm run build`                 | Produce production bundles in `dist/` and `dist/server/`. |
| `npm run build:frontend`        | Build the Vite client only.                               |
| `npm run build:backend`         | Bundle the Express server via tsup.                       |
| `npm run start`                 | Apply migrations then serve the built app.                |
| `npm run prod`                  | Serve the built backend without running migrations.       |
| `npm run check`                 | Run `drizzle-kit check`, TypeScript, and Prettier.        |
| `npm run db:gen`                | Emit SQL migrations after schema edits.                   |
| `npm run db:migrate`            | Apply pending Drizzle migrations.                         |
| `npm run db:push` / `db:studio` | Push schema OR open the Drizzle Studio UI.                |

### Testing

Formal test suites are still pending. Author backend specs as `*.spec.ts` or frontend tests as `*.test.tsx`, then execute single files manually with `tsx path/to/spec.ts`.

## Project Layout

```
backend/   Express server, Socket.IO, database layer, managers
common/    Shared TypeScript models and utilities
frontend/  React app components, pages, contexts, and styling
data/      Local SQLite database (created automatically, ignored by Git)
```

Key backend flows live under `backend/src/managers/`, while shared DTOs reside in `common/models/`. Frontend routes sit in `frontend/app/pages/` and reuse reusable UI from `frontend/app/components/`.

## CSV Imports

Admins can visit `/admin` to upload CSV files matching the sample schemas in `data/*.csv`. Each upload reports inserted, updated, and skipped rows to confirm the data outcome. Ensure the column order mirrors the template files (e.g., `email,firstName,lastName,id,shortName,password` for users).

## Sessions Module

The `/sessions` route shows upcoming and past events. Authorized users may create, edit, or cancel sessions with optional locations and descriptions. Attendees can RSVP; ICS feeds are available via `/api/sessions/calendar.ics`, and individual invites can be downloaded per session.

## Configuration

- `SECRET` (required): JWT signing key; use a strong random value.
- `ORIGIN` (required in production): Allowed frontend origin for CORS.
- `TOKEN_EXPIRY_H` (optional): Override default 1-hour auth token expiry.
- `.env.example` also exposes `PRIVATE_KEY` for local defaults—never commit secrets.

## Docker

- Build: `docker build -t chugmania .`
- Run: `docker run -p 6996:6996 chugmania`
- The entrypoint executes `npm start`, so migrations apply automatically before serving.
- Mount `/app/data` as a volume to persist the SQLite database across restarts.

## Contributing

Follow the coding conventions from `AGENTS.md`: Prettier formatting (2 spaces, single quotes, no semicolons), organize imports, explicit TypeScript types, and the shared `Result<T>` error-handling pattern. Reuse existing components and respect the Formula 1-inspired Tailwind design system to keep UI consistent.
