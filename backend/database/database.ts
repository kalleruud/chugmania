import * as schema from '@database/schema'
import { drizzle } from 'drizzle-orm/libsql/node'

const db_file = process.env.DB_FILE_NAME
if (!db_file) throw Error("Missing environment varible 'DB_FILE_NAME'")

const db = drizzle({ connection: db_file, schema })
export default db
