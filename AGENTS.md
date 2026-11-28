# Agent Coding Guidelines

## Commands

- `bun install --frozen-lockfile` – install dependencies with Bun 1.4.4
- `bun run dev` – dev mode on `PORT` from `.env`, this is usually already running, avoid to run it yourself.
- `bun run check` – Drizzle, ESLint, TypeScript, and Prettier checks (run before commits)
- `bun run test` – run Bun tests with `tests/setup.ts` preloaded
- `bun run test tests/tournament.test.ts` – run a specific test file
- `bun run build` – build frontend + backend
- `bun run db:gen` – generate Drizzle migration after schema changes
- `bun run screenshot <route>...` – phone and desktop screenshots of the running dev app; see the `ui-preview` skill

## Testing in Development Mode

- Before starting the app, check whether it is already running (for example `curl -s localhost:$PORT`, with `PORT` from `.env`) and use that instance. Start a new one only when nothing is listening.
- Production (chugmania.no) runs on `localhost:6996`, the fallback when `PORT` is unset. Never use it for testing: do not connect to it, log in, or proxy to it. Use the randomly generated `PORT` from `.env` instead.
- The development database always contains realistic test data. Use it as the base for testing, and add, change, or remove records as a scenario needs instead of seeding a fresh database.
- When `NODE_ENV` is not `production`, server startup creates the admin `admin@chugmania.dev` with password `chugmania` if it does not exist. Use it to log in and test the running app, including `/admin`.
- A `Development` label above the `+` button confirms you are on a development build.

## UI Changes

- Whenever a request adds, changes, or mocks up UI, follow [.agents/skills/ui-preview/SKILL.md](.agents/skills/ui-preview/SKILL.md): show screenshots of the running dev app in chat, and add before/after screenshots to UI issues and PRs.

## Writing Tests

- Never write tests for frontend code; test backend behavior only.
- Follow [tests/tournament.test.ts](tests/tournament.test.ts); place new tests in `tests/<feature>.test.ts`.
- Use `bun:test` (`describe`, `test`, `expect`) and `node:assert/strict` for narrowing and rejected operations. Do not introduce another test framework.
- Write behavior-focused integration scenarios that call real manager request handlers and verify the returned or fetched state. Arrange data, perform the action, then assert the outcome.
- Reuse [tests/utils.ts](tests/utils.ts) for users, login, tracks, sessions, RSVPs, and `assertResponse`. Keep feature-specific helpers in the test file; share them only when another test file needs them.
- Use the migrated in-memory SQLite database from [tests/setup.ts](tests/setup.ts). Keep database and server boundary mocks there; exercise real authentication, business logic, ratings, and tournament generation.
- Group related workflows with `describe` and use `test.serial` when cases share state or build on earlier steps. Await every mutation before checking its effects.
- Give separate scenarios distinct user names and IDs because the database is shared across the run.
- Cover the meaningful success path and relevant invalid requests, permissions, or regressions. Use `assertResponse` for successful responses, `assert.rejects` for thrown failures, and verify broadcast payloads when testing reactive changes.
- Run `bun run test` and `bun run check` before committing test or behavior changes. Formatting and typechecking do not run the tests.

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
- After schema changes, run `bun run db:gen` to generate Drizzle migrations
- Put database access in `backend/database/sources/<entity>.source.ts` (for example `SessionSource`). Managers call source methods and contain no Drizzle queries. Some managers still query the database directly; move those queries into the source when you change them
- When adding new database tables, include them in the CSV import/export functionality by updating `AdminManager` in `backend/src/managers/admin.manager.ts` (add table to `TABLE_MAP` and `EXCLUDED_COL_EXPORT`). Exception: `webhookCaptures` and `webhookEvents` are backend-private and must remain excluded from client CSV import/export, along with result capture links; preserve this history through SQLite database backups

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

Write issues to the templates in `.github/ISSUE_TEMPLATE/`. When filing through `gh` or an API, the form is not applied, so build the body yourself with each field label as a `###` heading, in template order, and set the template's label.

- **Features** (`feature-request.yml`, label `enhancement`). Use this skeleton; the headings are level 3 (`###`), matching what the form produces:

  ```markdown
  ### Overview

  ### Acceptance requirements

  ### Implementation design

  ### Out of scope
  ```

- **Bugs** (`bug-report.yml`, label `bug`): written mainly by people. Agents filing a bug use the same fields and leave unknowns as "Unknown".

Feature issues describe the outcome and the design, not the work:

- **Overview**: one to three plain-language sentences a player or admin understands. No code names.
- **Acceptance requirements**: the few observable outcomes that define done, usually three to seven bullets. They say what must be true; the design says how. Edge cases, error states, and limits go in the design only; do not repeat them in acceptance requirements. Leave out project-wide rules such as "tests pass" or "follows existing patterns"; this file already requires them.
- **Implementation design**: explain in prose how the finished feature works: system behaviour, how data flows from a user action to what others see, and the rules that decide outcomes. Aim for under 400 words of prose plus tables. Describe new or changed screens in words: what appears where and what it shows. Database changes go in a table of columns; with none, say so in one sentence. Describe how the solution works, not how to build it: no steps, checklists, file paths, or function names. They go stale and mislead whoever builds the feature, who plans against the current code instead.
- **Out of scope**: only exclusions the request names; otherwise omit the section.
- Base every section on the request; do not invent scope.

Keep issues short enough to read in two minutes. Add background only when the design cannot be understood without it.

## Tools

- When needing to search docs, use `context7` tools.
- If you are unsure how to do something, use `gh_grep` to search code examples from github.
