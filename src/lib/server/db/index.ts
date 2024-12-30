import { DB_FILE_NAME } from '$env/static/private'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '$lib/server/db/schema'

const database = new Database('data/' + DB_FILE_NAME)
database.pragma('journal_mode = WAL')

const db = drizzle(database, { schema })
export default db
