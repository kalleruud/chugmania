# Chugmania Monorepo

This repository contains:

- `backend/`: Node.js + TypeScript Socket.IO server. Drizzle + SQLite in `backend/database/`, runtime data in `backend/data/`.
- `frontend/`: React + Vite app (TypeScript). Entry at `frontend/src/App.tsx`.
- `common/`: Shared TypeScript models/utilities, consumed via `file:../common`.

## Quick Start

### Backend

1. `cd backend && npm install`
2. Create `backend/.env` (see `.env.example`).
3. `npm start` to run the dev server (tsx watch).
4. Drizzle:
   - `npm run db:gen` | `db:migrate` | `db:push` | `db:studio`

### Frontend

1. `cd frontend && npm install`
2. `npm start` to run Vite dev server.
3. `npm run build` for type-check + production build.

### Common

No build; imported from backend/frontend using `file:../common`.

## Coding Style

- Prettier: 2 spaces, single quotes, no semicolons, trailing commas.
- TypeScript everywhere. Prefer explicit types at public boundaries.
- Backend managers use `name.manager.ts`; React components/contexts use `PascalCase.tsx`.
- Imports: use `../../../../common/*` in app code, `@database/*` within backend.

## Security & Config

- Required: `DB_URL` in backend env.
- Optional: `SECRET` (JWT), `TOKEN_EXPIRY_H` (default `1`).
- SQLite files are ignored by Git; back up migrations via Drizzle commands.
