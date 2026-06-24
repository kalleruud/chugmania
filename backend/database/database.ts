import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import * as schema from '../database/schema'

const db_url = 'data/db.sqlite'
mkdirSync(dirname(db_url), { recursive: true })
const database = new Database(db_url)
database.pragma('journal_mode = WAL')

const db = drizzle(database, { schema })
export { database }
export default db
