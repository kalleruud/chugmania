import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { mkdirSync } from 'node:fs'
import path, { dirname } from 'node:path'
import * as schema from '../database/schema'

const db_url = process.env.DATABASE_PATH ?? 'data/db.sqlite'
mkdirSync(dirname(db_url), { recursive: true })
const database = new Database(db_url)
database.run('PRAGMA journal_mode = WAL')
database.run('PRAGMA busy_timeout = 5000')

const db = drizzle(database, { schema })

database.run('PRAGMA foreign_keys = OFF')
try {
  migrate(db, {
    migrationsFolder: path.join(process.cwd(), 'drizzle'),
  })
} finally {
  database.run('PRAGMA foreign_keys = ON')
}
if (database.prepare('PRAGMA foreign_key_check').get() !== null)
  throw new Error('Database migration left invalid foreign-key references')

export { database }
export default db
