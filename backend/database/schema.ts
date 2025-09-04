import { randomUUID } from 'crypto'
import { blob, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { TrackLevel, TrackType } from './types'

const common = {
  id: text().primaryKey().$defaultFn(randomUUID),
  updatedAt: integer({ mode: 'timestamp' }).$onUpdateFn(() => new Date()),
  createdAt: integer({ mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  deletedAt: integer({ mode: 'timestamp' }),
}

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

export const tracks = sqliteTable('tracks', {
  ...common,
  number: integer().notNull(),
  level: text().$type<TrackLevel>().notNull(),
  type: text().$type<TrackType>().notNull(),
  isChuggable: integer({ mode: 'boolean' })
    .notNull()
    .$default(() => false),
})

export type { TrackLevel, TrackType }

export const timeEntries = sqliteTable('time_entries', {
  ...common,
  user: text()
    .notNull()
    .references(() => users.id),
  track: text()
    .notNull()
    .references(() => tracks.id),
  duration: integer('duration_ms').notNull(),
  amount: integer('amount_l').notNull(),
  comment: text(),
})
