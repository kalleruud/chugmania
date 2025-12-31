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
export type MatchStage =
  | 'group'
  | 'eight'
  | 'quarter'
  | 'semi'
  | 'bronze'
  | 'final'
  | 'grand_final'
  | 'loser_eight'
  | 'loser_quarter'
  | 'loser_semi'
  | 'loser_bronze'
  | 'loser_final'

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
  user1: text().references(() => users.id),
  user2: text().references(() => users.id),
  track: text().references(() => tracks.id),
  session: text().references(() => sessions.id),
  winner: text().references(() => users.id),
  duration: integer('duration_ms'),
  stage: text().$type<MatchStage>(),
  comment: text(),
  status: text()
    .$type<MatchStatus>()
    .notNull()
    .$default(() => 'planned'),
})

export type TournamentEliminationType = 'single' | 'double'
export type TournamentBracket = 'group' | 'upper' | 'lower'
export type TournamentSourceProgression = 'winner' | 'loser'

export const tournaments = sqliteTable('tournaments', {
  ...metadata,
  session: text()
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  description: text(),
  groupsCount: integer('groups_count').notNull(),
  advancementCount: integer('advancement_count').notNull(),
  eliminationType: text('elimination_type')
    .$type<TournamentEliminationType>()
    .notNull(),
})

export const groups = sqliteTable('groups', {
  ...metadata,
  tournament: text()
    .notNull()
    .references(() => tournaments.id, { onDelete: 'cascade' }),
  name: text().notNull(),
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

export const tournamentMatches = sqliteTable('tournament_matches', {
  ...metadata,
  tournament: text()
    .notNull()
    .references(() => tournaments.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  bracket: text().$type<TournamentBracket>().notNull(),
  round: integer().notNull(),
  match: text().references(() => matches.id, { onDelete: 'set null' }),
  completedAt: integer('completed_at', { mode: 'timestamp_ms' }),

  // dependency pointers (groups)
  sourceGroupA: text('source_group_a').references(() => groups.id, {
    onDelete: 'set null',
  }),
  sourceGroupARank: integer('source_group_a_rank'),
  sourceGroupB: text('source_group_b').references(() => groups.id, {
    onDelete: 'set null',
  }),
  sourceGroupBRank: integer('source_group_b_rank'),

  // dependency pointers (matches)
  sourceMatchA: text('source_match_a').references(() => tournamentMatches.id, {
    onDelete: 'set null',
  }),
  sourceMatchAProgression: text('source_match_a_progression').$type<TournamentSourceProgression>(),
  sourceMatchB: text('source_match_b').references(() => tournamentMatches.id, {
    onDelete: 'set null',
  }),
  sourceMatchBProgression: text('source_match_b_progression').$type<TournamentSourceProgression>(),
})
