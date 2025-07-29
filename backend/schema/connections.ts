import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { users } from './users.ts'

export type UserRole = 'admin' | 'moderator' | 'user'

export const connections = sqliteTable('connections', {
  socket: text().unique().notNull(),
  user: text().references(() => users.id),
  createdAt: integer({ mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
})
