import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../database/schema'

const DB_URL = process.env.DB_URL
if (!DB_URL) throw Error("Missing environment varible 'DB_URL'")

const database = new Database(DB_URL)
database.pragma('journal_mode = WAL')

const db = drizzle(database, { schema })
export default db
