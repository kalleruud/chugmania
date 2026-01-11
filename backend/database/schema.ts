import { blob, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { randomUUID } from 'node:crypto'

const metadata = {
  id: text().primaryKey().$defaultFn(randomUUID),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).$onUpdateFn(
    () => new Date()
  ),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
}

export type UserRole = 'admin' | 'moderator' | 'user'
export type SessionResponse = 'yes' | 'no' | 'maybe'
export type SessionStatus = 'confirmed' | 'tentative' | 'cancelled'
export type MatchStatus = 'planned' | 'completed' | 'cancelled'
export type EliminationType = 'single' | 'double'
export type TournamentBracket = 'group' | 'upper' | 'lower' | 'grand_final'
export type DependencySlot = 'A' | 'B'

export const users = sqliteTable('users', {
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
  ...metadata,
  number: integer().notNull(),
  level: text().$type<TrackLevel>().notNull(),
  type: text().$type<TrackType>().notNull(),
})

export const sessions = sqliteTable('sessions', {
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

export const sessionSignups = sqliteTable('session_signups', {
  ...metadata,
  session: text()
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  user: text()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  response: text().$type<SessionResponse>().notNull(),
})

export const timeEntries = sqliteTable('time_entries', {
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

export const matches = sqliteTable('matches', {
  ...metadata,
  userA: text('user_a').references(() => users.id),
  userB: text('user_b').references(() => users.id),
  winner: text().$type<DependencySlot>(),
  track: text()
    .notNull()
    .references(() => tracks.id),
  session: text().references(() => sessions.id),
  status: text()
    .$type<MatchStatus>()
    .notNull()
    .$default(() => 'planned'),
  duration: integer('duration_ms'),
  comment: text(),
})

export const tournaments = sqliteTable('tournaments', {
  ...metadata,
  session: text()
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  description: text(),
  groupsCount: integer('groups_count').notNull().default(2),
  advancementCount: integer('advancement_count').notNull().default(2),
  eliminationType: text('elimination_type')
    .$type<EliminationType>()
    .notNull()
    .$default(() => 'single'),
})

export const groups = sqliteTable('groups', {
  ...metadata,
  tournament: text()
    .notNull()
    .references(() => tournaments.id, { onDelete: 'cascade' }),
  index: integer().notNull(),
})

export const groupPlayers = sqliteTable('group_players', {
  ...metadata,
  group: text()
    .notNull()
    .references(() => groups.id, { onDelete: 'cascade' }),
  user: text()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  seed: integer().notNull(),
})

export const stages = sqliteTable('stages', {
  ...metadata,
  tournament: text()
    .notNull()
    .references(() => tournaments.id, { onDelete: 'cascade' }),
  bracket: text().$type<TournamentBracket>().notNull(),
  index: integer().notNull(),
})

export const tournamentMatches = sqliteTable('tournament_matches', {
  ...metadata,
  match: text()
    .notNull()
    .references(() => matches.id),
  stage: text()
    .notNull()
    .references(() => stages.id, { onDelete: 'cascade' }),
  index: integer().notNull(),
})

export const matchDependencies = sqliteTable('match_dependencies', {
  ...metadata,
  fromMatch: text('from_match').references(() => tournamentMatches.id),
  fromGroup: text('from_group').references(() => groups.id),
  toMatch: text('to_match')
    .notNull()
    .references(() => tournamentMatches.id),
  fromPosition: integer('from_position').notNull(),
  toSlot: text('to_slot').$type<DependencySlot>().notNull(),
})
