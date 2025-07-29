import { blob, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { common } from './common.ts'

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
