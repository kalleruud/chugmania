import {
  blob,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'
import { randomUUID } from 'node:crypto'

const id = {
  id: text().primaryKey().$defaultFn(randomUUID),
}

const metadata = {
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).$onUpdateFn(
    () => new Date()
  ),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
}

export const USER_ROLES = ['admin', 'moderator', 'user'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const users = sqliteTable('users', {
  ...id,
  ...metadata,
  email: text().notNull().unique(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name'),
  shortName: text('short_name').unique(),
  passwordHash: blob('password_hash', { mode: 'buffer' }).notNull(),
  role: text()
    .$type<UserRole>()
    .notNull()
    .$default(() => 'user'),
})

export type TrackLevel = 'white' | 'green' | 'blue' | 'red' | 'black' | 'custom'
export type TrackType = 'drift' | 'valley' | 'lagoon' | 'stadium'

export const tracks = sqliteTable('tracks', {
  ...id,
  ...metadata,
  number: integer().notNull(),
  level: text().$type<TrackLevel>().notNull(),
  type: text().$type<TrackType>().notNull(),
})

export type SessionResponse = 'yes' | 'no' | 'maybe'
export type SessionStatus = 'confirmed' | 'tentative' | 'cancelled'

export const sessions = sqliteTable('sessions', {
  ...id,
  ...metadata,
  name: text().notNull(),
  description: text(),
  date: integer({ mode: 'timestamp_ms' }).notNull(),
  location: text(),
  status: text()
    .$type<SessionStatus>()
    .notNull()
    .$default(() => 'confirmed'),
})

export const sessionSignups = sqliteTable(
  'session_signups',
  {
    ...metadata,
    session: text()
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    user: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    response: text().$type<SessionResponse>().notNull(),
  },
  table => [primaryKey({ columns: [table.session, table.user] })]
)

export const timeEntries = sqliteTable('time_entries', {
  ...id,
  ...metadata,
  user: text()
    .notNull()
    .references(() => users.id),
  track: text()
    .notNull()
    .references(() => tracks.id),
  session: text().references(() => sessions.id),
  duration: integer('duration_ms'),
  amount: integer('amount_l').notNull().default(0.5),
  comment: text(),
})
