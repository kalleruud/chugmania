# Repository Guidelines

## Project Structure & Module Organization
- `backend/`: Node.js + TypeScript Socket.IO server. Database in `backend/database/` (Drizzle + SQLite). Runtime data in `backend/data/`.
- `frontend/`: React + Vite app (TypeScript). Entry at `frontend/src/main.tsx`.
- `common/`: Shared TypeScript models and utilities, published locally as `@chugmania/common`.
- Root configs: `.prettierrc`, `.gitignore`, optional workspace settings in `.vscode/`.

## Build, Test, and Development Commands
- Backend
  - `cd backend && npm install`
  - `npm start`: Run dev server with `tsx` (watches `src/server.ts`).
  - `npm run check`: Type-checks and verifies Prettier formatting.
  - Drizzle: `npm run db:gen | db:migrate | db:push | db:studio`.
- Frontend
  - `cd frontend && npm install`
  - `npm start`: Run Vite dev server.
  - `npm run build`: Type-check and production build.
  - `npm run check`: Type-checks and verifies Prettier formatting.
- Common
  - `cd common`: No build; used via `file:../common`. Re-run `npm install` in frontend/backend after changes if linking breaks.

## Coding Style & Naming Conventions
- Formatting: Prettier (2 spaces, single quotes, no semicolons, trailing commas). Run in backend via `npm run check`.
- TypeScript everywhere. Prefer explicit types at public boundaries.
- Files: backend managers use `name.manager.ts`; React components/contexts use `PascalCase.tsx`.
- Imports: use `@chugmania/common/*` in app code, `@database/*` within backend.

## Testing Guidelines
- No formal tests configured yet. Prefer Vitest for unit tests and Playwright for e2e.
- Suggested patterns: `*.spec.ts` for backend/common; `*.test.tsx` for React.
- Place tests alongside sources (e.g., `src/foo.spec.ts`). Add `npm test` scripts when introducing the framework.

## Commit & Pull Request Guidelines
- Commits: short, imperative mood (e.g., “Add logout functionality”). Optional scope: `backend:`, `frontend:`, `common:`.
- PRs: include summary, motivation, screenshots for UI changes, and steps to test. Link issues with `Closes #123`.
- Keep changes focused; update docs when behavior or commands change.

## Security & Configuration Tips
- Backend env: set `DB_URL` (required), `SECRET` (JWT; optional), `TOKEN_EXPIRY_H` (default `1`). Create `backend/.env` for local dev.
- SQLite files are ignored by Git; back up migrations via Drizzle commands.
