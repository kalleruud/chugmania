import { Database } from 'bun:sqlite'
import { afterAll, mock } from 'bun:test'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import * as schema from '../backend/database/schema'

process.env.SECRET = 'test-secret'
process.env.DATABASE_PATH = ':memory:'

const database = new Database(':memory:')
database.run('PRAGMA foreign_keys = ON')
export const db = drizzle(database, { schema })
migrate(db, { migrationsFolder: 'drizzle' })

mock.module('../backend/database/database', () => ({ default: db, database }))
mock.module('../backend/src/server', () => ({ broadcast: mock() }))
afterAll(() => database.close())
