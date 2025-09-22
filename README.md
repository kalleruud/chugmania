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
3. `npm start`
   - Serves the API, WebSocket, and web app on `http://localhost:6996` via Vite Express.

The SQLite database lives at `data/db.sqlite`. The app creates the parent directory automatically if it is missing.

## Admin CSV Imports

- Signed-in admins can open `/admin` to bulk import data from CSV files.
- Each upload must match the columns used in `data/users.csv`, `data/tracks.csv`, or `data/timeEntry.csv`.
- Successful imports report how many rows were inserted, updated, or skipped so you can verify the outcome.

## Useful Scripts

- `npm run prod` – run the prebuilt backend (`dist/server/server.js`) with `NODE_ENV=production`.
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
- Mount `/app/data` as a volume if you need the database to persist across container restarts.
