# Repository Guidelines

## Project Structure & Module Organization
- `backend/`: Node.js + TypeScript Socket.IO server. Database in `backend/database/` (Drizzle + SQLite). Runtime data in `backend/data/`. Entry at `src/server.ts`.
- `frontend/`: React + Vite app (TypeScript). Entry at `frontend/src/App.tsx`.
- `common/`: Shared TypeScript models and utilities, consumed via `@chugmania/common`.
- Place tests next to sources (e.g., `backend/src/foo.spec.ts`, `frontend/src/Bar.test.tsx`).

## Build, Test, and Development Commands
- Backend
  - `cd backend && npm install`: Install server deps.
  - `npm start`: Run dev server with `tsx` (watches `src/server.ts`).
  - `npm run check`: Type-check and verify Prettier formatting.
  - Drizzle: `npm run db:gen | db:migrate | db:push | db:studio`.
- Frontend
  - `cd frontend && npm install`: Install web app deps.
  - `npm start`: Run Vite dev server.
  - `npm run build`: Type-check and production build.
- Common
  - `cd common`: Used via `file:../common`. If linking breaks, re-run `npm install` in frontend/backend.

## Coding Style & Naming Conventions
- Formatting: Prettier (2 spaces, single quotes, no semicolons, trailing commas). Run `npm run check` in `backend/`.
- Language: TypeScript everywhere. Prefer explicit types at public boundaries.
- Files: Backend managers use `name.manager.ts`. React components/contexts use `PascalCase.tsx`.
- Imports: Use `@chugmania/common/*` in app code and `@database/*` within backend.
 - Code principles: write the minimal, easy-readable solution; match existing patterns and file layout.
 - Keep functions small and focused; prefer clear names over cleverness.
 - Avoid unnecessary abstractions, comments, and dependencies; implement only what is needed for the task.
 - Respect existing module boundaries and naming; do not restructure unrelated code.

## Testing Guidelines
- Frameworks: Prefer Vitest for unit tests and Playwright for e2e.
- Naming: `*.spec.ts` for backend/common; `*.test.tsx` for React.
- Location: Place tests alongside sources (e.g., `src/foo.spec.ts`).
- Scripts: Add `npm test` when introducing a framework; keep tests fast and focused.

## Commit & Pull Request Guidelines
- Commits: Short, imperative messages (e.g., "Add logout functionality"). Optional scope: `backend:`, `frontend:`, `common:`.
- PRs: Include summary, motivation, screenshots for UI changes, and steps to test. Link issues with `Closes #123`.
- Scope: Keep changes focused; update docs when behavior or commands change.

## Security & Configuration Tips
- Backend env: set `DB_URL` (required), `SECRET` (JWT; optional), `TOKEN_EXPIRY_H` (default `1`). Create `backend/.env` for local dev.
- SQLite files are ignored by Git; back up migrations via Drizzle commands.
