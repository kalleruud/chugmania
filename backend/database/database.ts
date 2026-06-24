import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { mkdirSync } from 'node:fs'
import path, { dirname } from 'node:path'
import * as schema from '../database/schema'

const db_url = 'data/db.sqlite'
mkdirSync(dirname(db_url), { recursive: true })
const database = new Database(db_url)
database.pragma('journal_mode = WAL')

const db = drizzle(database, { schema })

migrate(db, {
  migrationsFolder: path.join(process.cwd(), 'drizzle'),
})

export { database }
export default db
