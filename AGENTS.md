# Agent Coding Guidelines

## Commands

- `npm run dev` – dev mode (port 6996), this is usually already running, avoid to run it yourself.
- `npm run check` – typecheck + Prettier format check (run before commits)
- `npm test` – run Bun tests with `tests/setup.ts` preloaded
- `npm test -- tests/tournament.test.ts` – run a specific test file
- `npm run build` – build frontend + backend
- `npm run db:gen` – generate Drizzle migration after schema changes

## Writing Tests

- Follow [tests/tournament.test.ts](tests/tournament.test.ts); place new tests in `tests/<feature>.test.ts`.
- Use `bun:test` (`describe`, `test`, `expect`) and `node:assert/strict` for narrowing and rejected operations. Do not introduce another test framework.
- Write behavior-focused integration scenarios that call real manager request handlers and verify the returned or fetched state. Arrange data, perform the action, then assert the outcome.
- Reuse [tests/utils.ts](tests/utils.ts) for users, login, tracks, sessions, RSVPs, and `assertResponse`. Keep feature-specific helpers in the test file; share them only when another test file needs them.
- Use the migrated in-memory SQLite database from [tests/setup.ts](tests/setup.ts). Keep database and server boundary mocks there; exercise real authentication, business logic, ratings, and tournament generation.
- Group related workflows with `describe` and use `test.serial` when cases share state or build on earlier steps. Await every mutation before checking its effects.
- Give separate scenarios distinct user names and IDs because the database is shared across the run.
- Cover the meaningful success path and relevant invalid requests, permissions, or regressions. Use `assertResponse` for successful responses, `assert.rejects` for thrown failures, and verify broadcast payloads when testing reactive changes.
- Run `npm test` and `npm run check` before committing test or behavior changes. Formatting and typechecking do not run the tests.

## Code Style

- Prettier: 2 spaces, single quotes, no semicolons, trailing commas, organize imports plugin
- TypeScript strict mode: explicit types at boundaries, no implicit any
- Avoid `any`-type; use explicit types instead
- Avoid `as const` assertions; rely on type inference or explicit type annotations
- Avoid nested ternary operations; extract to helper functions or variables for readability
- Naming: `name.manager.ts` (backend), `PascalCase.tsx` (React), camelCase vars/funcs
- Imports: use relative paths `@common/*` for shared code
- Error handling: use `Result<T>` pattern from `common/utils/try-catch.ts` with `{ data, error }` structure
- No comments unless required; code should be self-documenting

## Implementation Rules

- Match existing patterns before introducing new ones
- Implement the simplest solution; avoid unnecessary abstractions
- Reuse existing components (Button, SearchableDropdown, etc.)
- Use Tailwind CSS utilities; follow Formula 1 inspired dark-mode design system
- Use `date-fns` for Calendar component internals, but prefer `luxon` for general date formatting/manipulation in the app
- After schema changes, run `npm run db:gen` to generate Drizzle migrations
- When adding new database tables, include them in the CSV import/export functionality by updating `AdminManager` in `backend/src/managers/admin.manager.ts` (add table to `TABLE_MAP` and `EXCLUDED_COL_EXPORT`)

## Reactive Contract

- Treat the backend as reactive-first: every create/update/delete for tracks, users, lap times, sessions, and session signups must emit Socket.IO change events using the same DTOs as request responses.
- When adding endpoints, expose a shared fetch helper so the payload used for `emit` matches the payload returned via explicit fetch.
- Frontend listeners should refresh state through the same data-loading path they use on initial load.
- Surface change notifications via the shared toast framework; keep toasts reusable for future features like achievements and status alerts.
- Unexpected updates must still notify users; keep emissions role-aware so clients only receive data they can view.

## Project Structure

- `backend/`: Express + Socket.IO server, managers in `src/managers/`, database in `database/`
- `frontend/`: React + Vite, components in `app/components/`, pages in `app/pages/`
- `common/`: Shared models/utils consumed by both sides

## Issue Creation & Formatting

All GitHub issues must follow a consistent, concise format:

**Structure:**

1. **Overview** (1-2 sentences): What is being built and why
2. **Acceptance Requirements** (bullet list): Clear, testable requirements
3. **Implementation Plan** (checkbox list): Actionable steps organized by phase/area

**Example:**

```markdown
## Overview

Brief description of what and why in 1-2 sentences.

## Acceptance Requirements

- Feature/fix is testable and verifiable
- Code follows existing patterns
- All edge cases handled
- Tests pass with `npm test`, and `npm run check` passes

## Implementation Steps

### Backend

- [ ] Step 1
- [ ] Step 2

### Frontend

- [ ] Step 3
- [ ] Step 4

### Testing

- [ ] Test scenario 1
- [ ] Test scenario 2
```

Keep descriptions concise—avoid lengthy explanations of current state or background unless critical to understanding.

## Tools

- When needing to search docs, use `context7` tools.
- If you are unsure how to do something, use `gh_grep` to search code examples from github.
