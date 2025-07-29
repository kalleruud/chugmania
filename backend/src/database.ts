import { drizzle } from 'drizzle-orm/libsql/node'

const db = drizzle({ connection: 'file:local.db' })
export default db
