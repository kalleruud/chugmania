import { DATABASE } from '$env/static/private'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

const db = drizzle(new Database(DATABASE))
export default db
