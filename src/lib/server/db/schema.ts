import { getLocalTimeZone, today } from '@internationalized/date'
import { randomUUID } from 'crypto'
import { blob, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { SessionType } from '../managers/session.manager'
import type { TrackLevel, TrackType } from '../managers/track.manager'
import type { Role } from '../managers/user.manager'

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
  shortName: text('short_name').unique(),
  passwordHash: blob('password', { mode: 'buffer' }).notNull(),
  role: text('role')
    .$type<Role>()
    .notNull()
    .$default(() => 'user'),
})

export const sessions = sqliteTable('sessions', {
  ...common,
  description: text('description'),
  date: text('date')
    .notNull()
    .$defaultFn(() => today(getLocalTimeZone()).toString()),
  type: text('type').$type<SessionType>().notNull(),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id),
})

export const tracks = sqliteTable('tracks', {
  ...common,
  number: integer('number').notNull(),
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

export const matches = sqliteTable('matches', {
  ...common,
  user1: text('user_1')
    .notNull()
    .references(() => users.id),
  user2: text('user_2')
    .notNull()
    .references(() => users.id),
  winner: text('winner').references(() => users.id),
  track: text('track')
    .notNull()
    .references(() => tracks.id),
  session: text('session')
    .notNull()
    .references(() => sessions.id),
  amount: integer('amount_l').notNull(),
  comment: text('comment'),
})

export const groups = sqliteTable('groups', {
  ...common,
  name: text('name').notNull().unique(),
  session: text('session')
    .notNull()
    .references(() => sessions.id),
})

export const groupUsers = sqliteTable('group_users', {
  ...common,
  user: text('user')
    .notNull()
    .references(() => users.id),
  group: text('group')
    .notNull()
    .references(() => groups.id),
})
