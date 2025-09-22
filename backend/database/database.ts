import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../database/schema'

const db_url = 'data/db.sqlite'
const database = new Database(db_url)
database.pragma('journal_mode = WAL')

const db = drizzle(database, { schema })
export default db
