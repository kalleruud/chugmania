# Test Database Usage Guide

The test database infrastructure allows you to test backend managers with a real in-memory SQLite database instead of mocks.

## Quick Start

```typescript
import { describe, it, expect } from 'vitest'
import { createTestDb, swapDb, restoreDb } from './test-db'
import UserManager from '../managers/user.manager'

describe('UserManager', () => {
  it('should do something', async () => {
    // 1. Create fresh in-memory DB with schema migrated
    const testDb = await createTestDb()

    // 2. Swap it so managers use testDb
    swapDb(testDb)

    try {
      // 3. Use existing managers - they now use testDb
      const user = await UserManager.onRegister({
        email: 'alice@example.com',
        firstName: 'Alice',
        passwordHash: Buffer.from('password123'),
      })

      // 4. Assert on the result
      expect(user.email).toBe('alice@example.com')
    } finally {
      // 5. Always restore original db
      restoreDb()
    }
  })
})
```

## Core Concepts

### `createTestDb()`

Creates a fresh in-memory SQLite database with all schema tables migrated.

```typescript
const testDb = await createTestDb()
// testDb is a Drizzle instance with full schema
```

**Features:**

- In-memory (fast, no disk I/O)
- Fresh for each test (zero state leakage)
- Schema auto-migrated from `./drizzle/` folder
- Uses same Drizzle instance as production code

### `swapDb(testDb)`

Temporarily replaces the global `db` export so all managers use `testDb`.

```typescript
swapDb(testDb)
// Now UserManager, SessionManager, etc all use testDb internally
```

**How it works:**

- Modifies Node's `require.cache` for the database module
- All managers that imported `db` now reference `testDb`
- No manager code changes needed

### `restoreDb()`

Restores the original production database.

```typescript
restoreDb()
// Managers back to using original db
```

**Important:** Always use `try/finally` to ensure restoration:

```typescript
const testDb = await createTestDb()
swapDb(testDb)

try {
  // ... test code ...
} finally {
  restoreDb() // Guaranteed to run even if test fails
}
```

## Common Patterns

### Pattern 1: Test Manager Operations

```typescript
it('should create and retrieve user', async () => {
  const testDb = await createTestDb()
  swapDb(testDb)

  try {
    const user = await UserManager.onRegister({
      email: 'test@example.com',
      firstName: 'Test',
      passwordHash: Buffer.from('hash'),
    })

    expect(user.email).toBe('test@example.com')

    const retrieved = await UserManager.getUserById(user.id)
    expect(retrieved.firstName).toBe('Test')
  } finally {
    restoreDb()
  }
})
```

### Pattern 2: Query DB State Directly

```typescript
it('should persist data to database', async () => {
  const testDb = await createTestDb()
  swapDb(testDb)

  try {
    await UserManager.onRegister({
      email: 'user1@example.com',
      firstName: 'User1',
      passwordHash: Buffer.from('hash'),
    })

    await UserManager.onRegister({
      email: 'user2@example.com',
      firstName: 'User2',
      passwordHash: Buffer.from('hash'),
    })

    // Query testDb directly for state verification
    const allUsers = await testDb.query.users.findMany()
    expect(allUsers).toHaveLength(2)
  } finally {
    restoreDb()
  }
})
```

### Pattern 3: Verify Cascading Deletes

```typescript
it('should cascade delete signups when session deleted', async () => {
  const testDb = await createTestDb()
  swapDb(testDb)

  try {
    // Setup: Create user, session, signup
    const user = await UserManager.onRegister({...})
    const session = await SessionManager.onCreateSession({...})
    await SessionManager.onRsvpSession({
      session: session.id,
      user: user.id,
      response: 'yes',
    })

    // Verify signup exists
    const signupsBefore = await testDb.query.sessionSignups.findMany()
    expect(signupsBefore).toHaveLength(1)

    // Delete session
    await SessionManager.onDeleteSession({...})

    // Verify cascade: signups should be deleted
    const signupsAfter = await testDb.query.sessionSignups.findMany()
    expect(signupsAfter).toHaveLength(0)
  } finally {
    restoreDb()
  }
})
```

### Pattern 4: Isolated Tests (No Pollution)

```typescript
it('test A: first scenario', async () => {
  const testDb = await createTestDb()
  swapDb(testDb)
  try {
    // ... test code ...
  } finally {
    restoreDb()
  }
})

it('test B: independent scenario', async () => {
  // This gets a FRESH empty DB
  const testDb = await createTestDb()
  swapDb(testDb)
  try {
    // Test A's data is NOT here - clean slate
    const users = await testDb.query.users.findMany()
    expect(users).toHaveLength(0)
  } finally {
    restoreDb()
  }
})
```

## Best Practices

✅ **DO:**

- Use `try/finally` with `restoreDb()`
- Create managers normally - they use testDb automatically
- Query `testDb` directly for state verification
- Create test data using existing managers (mirrors production)
- Expect each test to have a fresh DB

✗ **DON'T:**

- Forget `restoreDb()` - always use try/finally
- Assume test execution order
- Reuse testDb across tests
- Manually modify testDb after `restoreDb()`
- Create raw SQL data - use managers instead

## How It Works (Technical Details)

The module swapping works by replacing Node's `require.cache` entry for the database module:

1. When managers import `db`, Node caches it
2. `swapDb()` replaces the cached export with `testDb`
3. All managers see `testDb` (no code changes needed)
4. `restoreDb()` restores the original export

This works because managers imported `db` once at load time and captured a reference. By changing what that reference points to, we change their behavior without refactoring.

## Testing Different Managers

Each manager has its own set of methods. Check the manager files for the actual method names:

- `UserManager`: `onRegister()`, `onEditUser()`, `onDeleteUser()`, `getUserById()`, etc.
- `SessionManager`: `onCreateSession()`, `onEditSession()`, `onRsvpSession()`, `onDeleteSession()`, etc.
- `TrackManager`: `onCreateTrack()`, `onEditTrack()`, `onDeleteTrack()`, etc.
- `TournamentManager`: `onCreateTournament()`, etc.
- And more...

Check `backend/src/managers/*.ts` for the full API.

## Troubleshooting

**Q: Test still uses production DB?**
A: Make sure you called `swapDb(testDb)` before using managers, and that it's wrapped in try/finally.

**Q: Data from one test leaks to another?**
A: Each test must call `createTestDb()` to get a fresh DB. If you reuse the same testDb instance, data will persist.

**Q: Module swapping doesn't work?**
A: The database.ts file must be already loaded before swapDb is called. This happens automatically when you import a manager, but ensure managers are imported at the top of your test file.

**Q: Type errors when querying testDb?**
A: The `testDb` instance is a full Drizzle instance with all schema types. Use the same query syntax as production code.
