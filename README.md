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
   - Serves the API/WebSocket server on `http://localhost:6997`.
   - Serves the web app on `http://localhost:6996` via Vite Express proxy.

The SQLite database lives at `data/db.sqlite`. The app creates the parent directory automatically if it is missing.

## Useful Scripts

- `npm run prod` – start the server in production mode (no file watching).
- `npm run build` – build the frontend for production.
- `npm run check` – type-check the entire project and verify Prettier formatting.
- `npm run db:gen` / `db:migrate` / `db:push` / `db:studio` – Drizzle schema tooling.

## Coding Style

- Prettier: 2 spaces, single quotes, no semicolons, trailing commas.
- TypeScript across the stack; add explicit types on public boundaries.
- Backend managers use `name.manager.ts`; React components/contexts use `PascalCase.tsx`.
- Imports: reference shared code via `../../../../common/*` and backend database modules via `@database/*` aliases.

## Security & Config

- Optional env vars: `SECRET` (JWT signing key) and `TOKEN_EXPIRY_H` (default `1`).
- Keep `.env` out of source control; copy from `.env.example` for local development.
- SQLite files are ignored by Git; use the Drizzle commands above to manage schema changes.

## Docker

- The provided `Dockerfile` builds a production image that seeds the SQLite database at `/app/data/db.sqlite`.
- Build with `docker build -t chugmania .` and run with `docker run -p 6996:6996 chugmania`.
- Mount `/app/data` as a volume if you need the database to persist across container restarts.
