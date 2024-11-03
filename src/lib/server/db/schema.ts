import { sqliteTable, text, integer, blob } from 'drizzle-orm/sqlite-core'
import { randomUUID } from 'crypto'

export type TrackLevel = 'white' | 'green' | 'blue' | 'red' | 'black' | 'custom'
export type TrackType = 'drift' | 'valley' | 'lagoon' | 'stadium'
export type SessionType = 'practice' | 'tournament'

const common = {
  id: text('id').primaryKey().$defaultFn(randomUUID),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$onUpdateFn(() => new Date()),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
}

export const users = sqliteTable('users', {
  ...common,
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: blob('password', { mode: 'buffer' }).notNull(),
  isAdmin: integer('is_admin', { mode: 'boolean' })
    .notNull()
    .$default(() => false),
})

export const sessions = sqliteTable('sessions', {
  ...common,
  date: integer('date').notNull(),
  type: text('type').$type<SessionType>().notNull(),
})

export const tracks = sqliteTable('tracks', {
  ...common,
  name: text('name').unique().notNull(),
  level: text('level').$type<TrackLevel>().notNull(),
  type: text('type').$type<TrackType>().notNull(),
  isChuggable: integer('is_chuggable', { mode: 'boolean' })
    .notNull()
    .$default(() => false),
})

export const timeEntries = sqliteTable('time_entries', {
  ...common,
  user: text('user')
    .notNull()
    .references(() => users.id),
  track: text('track')
    .notNull()
    .references(() => tracks.id),
  session: text('session')
    .notNull()
    .references(() => sessions.id),
  duration: integer('duration_ms').notNull(),
  amount: integer('amount_l').notNull(),
  comment: text('comment'),
})
