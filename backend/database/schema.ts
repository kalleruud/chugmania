import {
  blob,
  index,
  integer,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'
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
export type EliminationType = 'single' | 'double'
export type TournamentBracket = 'group' | 'upper' | 'lower'
export type MatchProgression = 'winner' | 'loser'
export type PublicationState = 'draft' | 'published'

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
  uid: text().unique(),
  name: text(),
  author: text(),
  environment: text(),
  mapType: text('map_type'),
  authorMedalTimeMs: integer('author_medal_time_ms'),
  goldMedalTimeMs: integer('gold_medal_time_ms'),
  silverMedalTimeMs: integer('silver_medal_time_ms'),
  bronzeMedalTimeMs: integer('bronze_medal_time_ms'),
  isLaps: integer('is_laps', { mode: 'boolean' }),
  totalLaps: integer('total_laps'),
  checkpointsPerLap: integer('checkpoints_per_lap'),
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

export const webhooks = sqliteTable(
  'webhooks',
  {
    id: text().primaryKey(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).$onUpdateFn(
      () => new Date()
    ),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    gameId: text('game_id').notNull(),
    type: text().notNull(),
    session: text().references(() => sessions.id),
    receivedAt: integer('received_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    payload: text({ mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  },
  table => [index('webhooks_game_id_idx').on(table.gameId)]
)

export const timeEntries = sqliteTable('time_entries', {
  ...metadata,
  user: text().references(() => users.id),
  track: text().references(() => tracks.id),
  session: text().references(() => sessions.id),
  duration: integer('duration_ms'),
  chugDurationMs: integer('chug_duration_ms'),
  publicationState: text('publication_state')
    .$type<PublicationState>()
    .notNull()
    .default('published'),
  webhookGameId: text('webhook_game_id').unique(),
  publishedAt: integer('published_at', { mode: 'timestamp_ms' }),
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
  user1DurationMs: integer('user1_duration_ms'),
  user2DurationMs: integer('user2_duration_ms'),
  user1ChugDurationMs: integer('user1_chug_duration_ms'),
  user2ChugDurationMs: integer('user2_chug_duration_ms'),
  publicationState: text('publication_state')
    .$type<PublicationState>()
    .notNull()
    .default('published'),
  webhookGameId: text('webhook_game_id').unique(),
  publishedAt: integer('published_at', { mode: 'timestamp_ms' }),
  stage: text().$type<MatchStage>(),
  comment: text(),
  status: text()
    .$type<MatchStatus>()
    .notNull()
    .$default(() => 'planned'),
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
  round: integer(),
  match: text().references(() => matches.id),
  track: text().references(() => tracks.id),
  completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  sourceGroupA: text('source_group_a').references(() => groups.id),
  sourceGroupARank: integer('source_group_a_rank'),
  sourceGroupB: text('source_group_b').references(() => groups.id),
  sourceGroupBRank: integer('source_group_b_rank'),
  sourceMatchA: text('source_match_a'),
  sourceMatchAProgression: text(
    'source_match_a_progression'
  ).$type<MatchProgression>(),
  sourceMatchB: text('source_match_b'),
  sourceMatchBProgression: text(
    'source_match_b_progression'
  ).$type<MatchProgression>(),
})
