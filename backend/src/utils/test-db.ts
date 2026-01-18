import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import path from 'node:path'
import * as schema from '../../database/schema'

let originalDb: any = null
const testDbMap = new Map<string, any>()

/**
 * Create a fresh in-memory test database with schema migrated
 */
export async function createTestDb() {
  const database = new Database(':memory:')
  database.pragma('journal_mode = WAL')
  const db = drizzle(database, { schema })

  // Run migrations from drizzle/ folder
  await migrate(db, {
    migrationsFolder: path.resolve('./drizzle'),
  })

  return db
}

/**
 * Swap the global db export with a test database
 * Each test gets a unique ID to support nested/concurrent tests
 */
export function swapDb(testDb: any, testId: string = 'default') {
  const dbPath = require.resolve('../../database/database.ts')

  if (!originalDb && testId === 'default') {
    originalDb = require.cache[dbPath]?.exports?.default
  }

  testDbMap.set(testId, testDb)

  // Override the default export in the module cache
  if (require.cache[dbPath]) {
    require.cache[dbPath].exports.default = testDb
  }
}

/**
 * Restore the original db export
 */
export function restoreDb(testId: string = 'default') {
  testDbMap.delete(testId)

  if (originalDb && testId === 'default') {
    const dbPath = require.resolve('../../database/database.ts')
    if (require.cache[dbPath]) {
      require.cache[dbPath].exports.default = originalDb
    }
  }
}
