# Test Database Infrastructure

## ✅ Implementation Complete

The minimal in-memory database testing infrastructure is now ready to use.

### Files Created

1. **`test-db.ts`** (57 lines)
   - `createTestDb()` - Creates fresh in-memory DB with migrations
   - `swapDb()` - Temporarily replaces global db export
   - `restoreDb()` - Restores original db

2. **`TEST_DB_USAGE.md`** (Complete usage guide)
   - Quick start examples
   - Common patterns
   - Best practices
   - Troubleshooting

### What It Does

Allows you to test backend managers with a **real in-memory SQLite database** instead of mocks:

```typescript
import { createTestDb, swapDb, restoreDb } from '../utils/test-db'

it('should create user', async () => {
  const testDb = await createTestDb()
  swapDb(testDb)

  try {
    const user = await UserManager.onRegister({
      email: 'test@example.com',
      firstName: 'Test',
      passwordHash: Buffer.from('hash'),
    })

    expect(user.email).toBe('test@example.com')
  } finally {
    restoreDb()
  }
})
```

### Key Features

✅ **Minimal** - Just 3 functions, 57 lines  
✅ **No Refactoring** - Managers work as-is, no DI needed  
✅ **Fast** - In-memory DB, no disk I/O  
✅ **Isolated** - Each test gets fresh DB, zero pollution  
✅ **Real Operations** - Tests actual DB logic, constraints, migrations  
✅ **Type Safe** - Full TypeScript support

### How It Works

1. Creates in-memory `:memory:` SQLite database
2. Runs Drizzle migrations from `./drizzle/` folder
3. Temporarily replaces global `db` export via `require.cache`
4. All managers automatically use test DB
5. Restores original db after test

No manager code changes needed - the swap happens transparently.

### Getting Started

1. Read **`TEST_DB_USAGE.md`** for complete guide
2. Choose a manager test to write
3. Follow the 5-step pattern:
   - Create testDb
   - Swap it
   - Use managers
   - Assert
   - Restore (always in try/finally)

### Example: Testing UserManager

```typescript
import { describe, it, expect } from 'vitest'
import { createTestDb, swapDb, restoreDb } from '../utils/test-db'
import UserManager from './user.manager'

describe('UserManager', () => {
  it('should register a new user', async () => {
    const testDb = await createTestDb()
    swapDb(testDb)

    try {
      const user = await UserManager.onRegister({
        email: 'alice@example.com',
        firstName: 'Alice',
        passwordHash: Buffer.from('secret'),
      })

      expect(user.email).toBe('alice@example.com')

      // Query test DB directly for verification
      const allUsers = await testDb.query.users.findMany()
      expect(allUsers).toHaveLength(1)
    } finally {
      restoreDb()
    }
  })

  it('should update user info', async () => {
    const testDb = await createTestDb()
    swapDb(testDb)

    try {
      const user = await UserManager.onRegister({
        email: 'bob@example.com',
        firstName: 'Bob',
        passwordHash: Buffer.from('secret'),
      })

      const updated = await UserManager.onEditUser(
        { id: user.id },
        { firstName: 'Robert' }
      )

      expect(updated.firstName).toBe('Robert')
    } finally {
      restoreDb()
    }
  })
})
```

### Testing Cascade Operations

```typescript
it('should cascade delete signups when session deleted', async () => {
  const testDb = await createTestDb()
  swapDb(testDb)

  try {
    // Setup: Create interdependent data
    const user = await UserManager.onRegister({...})
    const session = await SessionManager.onCreateSession({...})
    await SessionManager.onRsvpSession({
      session: session.id,
      user: user.id,
      response: 'yes',
    })

    // Verify signup exists
    let signups = await testDb.query.sessionSignups.findMany()
    expect(signups).toHaveLength(1)

    // Delete session - should cascade
    await SessionManager.onDeleteSession({...})

    // Verify cascade worked
    signups = await testDb.query.sessionSignups.findMany()
    expect(signups).toHaveLength(0)
  } finally {
    restoreDb()
  }
})
```

### Testing Multiple Scenarios (Each Isolated)

```typescript
describe('UserManager - Multiple scenarios', () => {
  it('scenario A', async () => {
    const testDb = await createTestDb()
    swapDb(testDb)
    try {
      // Test scenario A
    } finally {
      restoreDb()
    }
  })

  it('scenario B - fresh DB, no pollution from A', async () => {
    const testDb = await createTestDb() // Fresh empty DB
    swapDb(testDb)
    try {
      // Data from scenario A doesn't exist here
      const users = await testDb.query.users.findMany()
      expect(users).toHaveLength(0)
    } finally {
      restoreDb()
    }
  })
})
```

### Best Practices

✅ Always use try/finally with restoreDb()
✅ Create managers normally - they auto-use testDb
✅ Query testDb directly for state verification  
✅ Use existing manager methods to seed data
✅ Expect each test to have isolated fresh DB

✗ Don't forget restoreDb()
✗ Don't assume test execution order
✗ Don't reuse testDb across multiple tests
✗ Don't create raw SQL data - use managers

### What's Next?

1. Write your first test using this infrastructure
2. Test one manager class thoroughly
3. Expand to other managers
4. Build comprehensive test suite for critical business logic

The infrastructure is ready - just start writing tests! 🚀

---

For detailed documentation, see: **`TEST_DB_USAGE.md`**
