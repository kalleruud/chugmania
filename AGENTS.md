# Agent Coding Guidelines

## Commands

- `npm run dev` – dev mode (port 6996)
- `npm run check` – typecheck + Prettier + Drizzle validation (run before commits)
- `npm run build` – build frontend + backend
- `npm run db:gen` – generate Drizzle migration after schema changes
- `npm run db:migrate` – apply pending migrations
- `npm run db:studio` – open Drizzle Studio UI
- `npm run test` – run all tests with Vitest
- `npm run test:watch` – run tests in watch mode
- `npm run test:coverage` – run tests with coverage reporting for SonarQube

## Tech Stack

- **Backend:** Express 5, Socket.IO, Drizzle ORM (SQLite), JWT auth
- **Frontend:** React 19, Vite, Tailwind CSS, shadcn/ui, Luxon (dates)
- **Testing:** Vitest with v8 coverage provider, LCOV reporting for SonarQube
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
- Write tests for new features: place tests as `*.spec.ts` (backend) or `*.test.tsx` (frontend) next to sources
- Run `npm run test` to verify tests pass before committing
- Coverage is tracked via SonarQube; use `npm run test:coverage` to generate local coverage reports

## Testing Best Practices

- Only test public methods
- Do not modify other files than _.spec.ts, _.test.ts or test.helpers.ts when writing tests.
- If the tests fail because of a bug in the code that is being tested, stop writing tests and ask the user if you can fix it.

### Blueprint Test Pattern

Use the following pattern when writing manager tests with the in-memory test database:

**ARRANGE-ACT-ASSERT Structure:**

1. **ARRANGE**: Set up test data using public manager APIs (not direct database insertion)
   - **Each test must set up its own database state** - do NOT share setup between tests
   - Use `clearDB()` to reset database state in `beforeEach` hook
   - Each test calls helper functions to create its own isolated test context
   - Use existing public APIs like `UserManager.onRegister()`, `SessionManager.onCreateSession()`, etc.
   - Avoid bypassing registration workflows or validation
2. **ACT**: Call the method under test
3. **ASSERT**: Verify the results with specific assertions

**Database Isolation (Critical):**

- **Only call `clearDB()` in `beforeEach`** - this ensures a fresh database for each test
- **Never call `clearDB()` in `beforeAll`** - this causes test pollution because tests would share state
- **Each test must independently create all data it needs** - use helper functions
- Test isolation prevents cascading failures where fixing one test breaks another
- Ensures tests can run in parallel without conflicts

Example of CORRECT isolation:

```typescript
describe('ManagerName - Feature', () => {
  beforeEach(async () => {
    await clearDB() // ✅ Correct: reset before EACH test
  })

  it('first test', async () => {
    const { socket } = await createMockAdmin() // ✅ Each test creates its own admin
    const users = await registerMockUsers(socket, 4) // ✅ Each test creates its own users
    // ... test logic
  })

  it('second test', async () => {
    const { socket } = await createMockAdmin() // ✅ Fresh admin for this test
    const users = await registerMockUsers(socket, 2) // ✅ Fresh users for this test
    // ... test logic
  })
})
```

**Database Setup:**

- Use in-memory SQLite (`:memory:` database in test mode via `NODE_ENV=test`)
- `clearDB()` from test helpers handles sequential deletion respecting foreign key constraints
- Database migrations auto-apply on test startup via Drizzle

**Socket Creation for Tests:**

- Use `createMockAdmin()` or `createMockSocket(userId)` from test helpers
- Socket auth is verified via JWT in `AuthManager.checkAuth()`
- Sockets include token in handshake for authentication

**Test Data Creation:**

- Use methods in `@backend/src/utils/test.helpers.ts`, create new ones to avoid code duplication.
- Use `randomUUID()` to predefine IDs to avoid having to fetch data after creation.

**Example Template:**

```typescript
describe('ManagerName - Feature', () => {
  beforeEach(async () => {
    await clearDB()
    setupRatingManagerMock() // if needed
  })

  it('should verify behavior', async () => {
    // ARRANGE
    const { socket } = await createMockAdmin()
    const [user1, user2] = await registerMockUsers(socket, 2)

    const sessionId = randomUUID()
    await SessionManager.onCreateSession(socket, {
      type: 'CreateSessionRequest',
      id: sessionId,
      name: 'Test Session',
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })

    // ACT
    const result = await ManagerUnderTest.methodName(someParam)

    // ASSERT
    expect(result).toHaveProperty('expectedProp')
  })
})
```

**Test File Locations:**

- Backend: `*.spec.ts` next to source files (e.g., `src/managers/user.manager.spec.ts`)
- Frontend: `*.test.tsx` next to source files (e.g., `components/Button.test.tsx`)

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
