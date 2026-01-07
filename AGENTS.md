# Agent Coding Guidelines

## Commands

- `npm run dev` – dev mode (port 6996)
- `npm run check` – typecheck + Prettier + Drizzle validation (run before commits)
- `npm run build` – build frontend + backend
- `npm run db:gen` – generate Drizzle migration after schema changes
- `npm run db:migrate` – apply pending migrations
- `npm run db:studio` – open Drizzle Studio UI
- No test framework yet; place tests as `*.spec.ts` (backend) or `*.test.tsx` (frontend) next to sources

## Tech Stack

- **Backend:** Express 5, Socket.IO, Drizzle ORM (SQLite), JWT auth
- **Frontend:** React 19, Vite, Tailwind CSS, shadcn/ui, Luxon (dates)
- **Shared:** TypeScript strict mode, `@common/*` path alias

## Code Style

- Prettier: 2 spaces, single quotes, no semicolons, trailing commas, organize imports plugin
- TypeScript strict mode: explicit types at boundaries, no implicit any
- Avoid `any`-type; use explicit types instead
- Avoid `as const` assertions; rely on type inference or explicit type annotations
- Avoid nested ternary operations; extract to helper functions or variables for readability
- Naming: `name.manager.ts` (backend), `PascalCase.tsx` (React), camelCase vars/funcs
- Imports: use path aliases `@common/*`, `@/*` (frontend), `@backend/*`
- No comments unless required; code should be self-documenting

## Implementation Rules

- Match existing patterns before introducing new ones
- Implement the simplest solution; avoid unnecessary abstractions
- Reuse existing components from `frontend/components/`
  - Use shadcn/ui components where possible from `frontend/components/ui/`
- Use Tailwind CSS utilities; follow Formula 1 inspired dark-mode design system
- Avoid making schema changes unless specifically requested. After schema changes, run `npm run db:gen` to generate Drizzle migrations
- When adding new database tables, include them in the CSV import/export functionality by updating `AdminManager` in `backend/src/managers/admin.manager.ts` (add table to `TABLE_MAP` and `EXCLUDED_COL_EXPORT`)

## Reactive Contract

- Treat the backend as reactive-first: every create/update/delete for tracks, users, lap times, sessions, and session signups must emit Socket.IO change events using the same DTOs as request responses.
- When adding endpoints, expose a shared fetch helper so the payload used for `emit` matches the payload returned via explicit fetch.
- Frontend listeners should refresh state through the same data-loading path they use on initial load.
- Surface change notifications via the shared toast framework; keep toasts reusable for future features like achievements and status alerts.
- Unexpected updates must still notify users; keep emissions role-aware so clients only receive data they can view.

## Project Structure

- `backend/`: Express + Socket.IO server, managers in `src/managers/`, database in `database/`
- `frontend/`: React + Vite, components in `components/`, pages in `app/pages/`
- `common/`: Shared models/utils consumed by both sides
- `data/db.sqlite`: SQLite database (auto-created, git-ignored)

## Key Patterns

**Manager Pattern:** Each domain (User, Track, Session, Tournament) has a manager class in `backend/src/managers/` with static methods handling database queries, business logic, and Socket.IO events.

**Global State:** React Context API with three main contexts:

- `ConnectionContext` – Socket.IO connection
- `DataContext` – Application data (users, tracks, sessions)
- `AuthContext` – Login state and current user

## Issue Creation & Formatting

All GitHub issues must follow a consistent, concise format:

**Structure:**

1. **Overview** (1 short paragraph): What is being built and why. If applicable, include a user story.
2. **Acceptance Requirements** (bullet list): Clear, testable requirements
3. **Flow** (if applicable): Description of the flow of the feature/fix.
4. **Implementation Plan** (checkbox list): Description of how the different files will be changed to implement the acceptance requirements.
   - For each file, describe the changes that will be made to it.

Keep descriptions concise—avoid lengthy explanations of current state or background unless critical to understanding.
