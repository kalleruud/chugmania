import { randomUUID } from 'crypto'
import { blob, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

const common = {
  id: text().primaryKey().$defaultFn(randomUUID),
  updatedAt: integer({ mode: 'timestamp' }).$onUpdateFn(() => new Date()),
  createdAt: integer({ mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  deletedAt: integer({ mode: 'timestamp' }),
}

export const connections = sqliteTable('connections', {
  socket: text().unique().notNull(),
  user: text().references(() => users.id),
  createdAt: integer({ mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
})

export type UserRole = 'admin' | 'moderator' | 'user'

export const users = sqliteTable('users', {
  ...common,
  email: text().notNull().unique(),
  name: text().notNull(),
  shortName: text().unique(),
  passwordHash: blob({ mode: 'buffer' }).notNull(),
  role: text()
    .$type<UserRole>()
    .notNull()
    .$default(() => 'user'),
})
