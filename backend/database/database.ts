import * as schema from '@database/schema.ts'
import { drizzle } from 'drizzle-orm/libsql/node'
import 'jsr:@std/dotenv/load'

const db_file = Deno.env.get('DB_FILE_NAME')
if (!db_file) throw Error("Missing environment varible 'DB_FILE_NAME'")

const db = drizzle({ connection: db_file, schema })
export default db
