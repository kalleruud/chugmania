import { DB_FILE_NAME } from '$env/static/private'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

const database = new Database('config/' + DB_FILE_NAME)
database.pragma('journal_mode = WAL')

const db = drizzle(database)
export default db
