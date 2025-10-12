# Chugmania

Full-stack Trackmania Turbo companion app for recording and exploring lap times. The backend (Express + Socket.IO + Drizzle/SQLite) and frontend (React + Vite) live in this single package and run together via Vite Express.

## Project Layout

- `backend/`: Server code, Socket.IO handlers, database access, and seeds.
- `frontend/`: React UI, components, and styles.
- `common/`: Shared TypeScript models/utilities consumed by both sides.
- `data/`: Development SQLite database (`/data/db.sqlite` at runtime). The directory is created on demand.

## Getting Started

1. `npm install`
2. Copy `.env.example` to `.env` and fill in overrides (see `Security & Config`).
3. For local development run `npm run dev`.
   - Boots Vite Express with hot reload on `http://localhost:6996`.
4. When you need the production bundle run `npm run build` followed by `npm start`.
   - `npm start` applies pending database migrations (`npm run db:migrate`) and serves the prebuilt backend/frontend from `dist/`.

The SQLite database lives at `data/db.sqlite`. The app creates the parent directory automatically if it is missing.

## Admin CSV Imports

- Signed-in admins can open `/admin` to bulk import data from CSV files.
- Each upload must match the columns used in `data/users.csv`, `data/tracks.csv`, or `data/timeEntry.csv`.
  - Users: `email,firstName,lastName,id,shortName,password`
- Successful imports report how many rows were inserted, updated, or skipped so you can verify the outcome.

## Sessions

- Visit `/sessions` to browse upcoming and past meetups.
- Admins and moderators can create new sessions with a name, date, and optional location.
- Sessions can include an optional description that appears on the page and inside the calendar export.
- Signed-in users can sign up or cancel their attendance before a session happens.
- Subscribe to all sessions with the Webcal feed (`/api/sessions/calendar.ics`) or download individual session invites from the page.
- Lap times can optionally be linked to a session when they are registered.

## Useful Scripts

- `npm start` – run pending migrations and boot the prebuilt backend/frontend.
- `npm run prod` – run the prebuilt backend (`dist/server/server.js`) without reapplying migrations.
- `npm run build` – build both the frontend bundle and the backend runtime (outputs to `dist/` and `dist/server/`).
- `npm run build:frontend` – build the Vite bundle only.
- `npm run build:backend` – bundle the backend/server with tsup.
- `npm run check` – type-check the entire project and verify Prettier formatting.
- `npm run db:gen` / `db:migrate` / `db:push` / `db:studio` – Drizzle schema tooling.

## Coding Style

- Prettier: 2 spaces, single quotes, no semicolons, trailing commas.
- TypeScript across the stack; add explicit types on public boundaries.
- Backend managers use `name.manager.ts`; React components/contexts use `PascalCase.tsx`.
- Imports: reference shared code via `../../../../common/*` and backend database modules via `@database/*` aliases.

## Security & Config

- Required in production: `SECRET` (JWT signing key) and `ORIGIN` (allowed frontend origin for CORS).
- Optional override: `TOKEN_EXPIRY_H` (default `1`).
- Keep `.env` out of source control; copy from `.env.example` for local development.
- SQLite files are ignored by Git; use the Drizzle commands above to manage schema changes.

## Docker

- The provided `Dockerfile` builds a production image that seeds the SQLite database at `/app/data/db.sqlite`.
- Build with `docker build -t chugmania .` and run with `docker run -p 6996:6996 chugmania`.
- The container entrypoint uses `npm start`, so migrations run on boot before the server starts.
- Mount `/app/data` as a volume if you need the database to persist across container restarts.
