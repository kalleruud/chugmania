# Agent Coding Guidelines

## Commands

- `npm run dev` – dev mode (port 6996)
- `npm run check` – typecheck + Prettier format check (run before commits)
- `npm run build` – build frontend + backend
- `npm run db:gen` – generate Drizzle migration after schema changes
- No test framework yet; place tests as `*.spec.ts` (backend) or `*.test.tsx` (frontend) next to sources

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
  - Use `NativeSelect` from `components/ui/native-select.tsx` for dropdowns
  - Use `Calendar` from `components/ui/calendar.tsx` for date picking
- Use Tailwind CSS utilities; follow Formula 1 inspired dark-mode design system
- Use `date-fns` for Calendar component internals, but prefer `luxon` for general date formatting/manipulation in the app
- After schema changes, run `npm run db:gen` to generate Drizzle migrations

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
- Tests pass with `npm run check`

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
