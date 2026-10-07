import { sql } from 'drizzle-orm'
import {
  blob,
  check,
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import { randomUUID } from 'node:crypto'
import type { MatchStage } from '../../common/models/match'
import type {
  EliminationType,
  PreviewVisibility,
  Slot,
  TournamentStatus,
} from '../../common/models/tournament'

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
export type { MatchStage } from '../../common/models/match'

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
  number: integer(),
  level: text().$type<TrackLevel>().notNull(),
  type: text().$type<TrackType>(),
  uid: text().unique(),
  name: text(),
  author: text(),
  environment: text(),
  mapType: text('map_type'),
  authorMedalMs: integer('author_medal_ms'),
  goldMedalMs: integer('gold_medal_ms'),
  silverMedalMs: integer('silver_medal_ms'),
  bronzeMedalMs: integer('bronze_medal_ms'),
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

export const webhookCaptures = sqliteTable('webhook_captures', {
  ...metadata,
  gameId: text('game_id').notNull().unique(),
  session: text()
    .notNull()
    .references(() => sessions.id),
  totalPlayers: integer('total_players').notNull(),
  sourceGame: text('source_game').notNull(),
  pluginName: text('plugin_name').notNull(),
  pluginVersion: text('plugin_version').notNull(),
  endedAt: integer('ended_at', { mode: 'timestamp_ms' }),
  publishedAt: integer('published_at', { mode: 'timestamp_ms' }),
})

export const webhookEvents = sqliteTable(
  'webhook_events',
  {
    ...metadata,
    eventId: text('event_id').notNull().unique(),
    capture: text()
      .notNull()
      .references(() => webhookCaptures.id, { onDelete: 'cascade' }),
    sequence: integer().notNull(),
    type: text().notNull(),
    occurredAt: integer('occurred_at', { mode: 'timestamp_ms' }).notNull(),
    rawPayload: text('raw_payload').notNull(),
  },
  table => [
    uniqueIndex('webhook_capture_sequence').on(table.capture, table.sequence),
  ]
)

export const timeEntries = sqliteTable(
  'time_entries',
  {
    ...metadata,
    user: text().references(() => users.id),
    track: text().references(() => tracks.id),
    session: text().references(() => sessions.id),
    publicationState: text('publication_state')
      .$type<'draft' | 'published'>()
      .notNull()
      .default('published'),
    webhookCapture: text('webhook_capture')
      .unique()
      .references(() => webhookCaptures.id),
    chugDurationMs: integer('chug_duration_ms'),
    duration: integer('duration_ms'),
    status: text().$type<MatchStatus>().notNull().default('completed'),
    tieBreaker: integer('tie_breaker', { mode: 'boolean' })
      .notNull()
      .default(false),
    amount: integer('amount_l').notNull().default(0.5),
    comment: text(),
  },
  table => [
    uniqueIndex('session_track_user_tie_breaker')
      .on(table.session, table.track, table.user)
      .where(sql`${table.tieBreaker} = 1`),
    check(
      'time_entry_published_assignment',
      sql`${table.publicationState} = 'draft' OR (${table.user} IS NOT NULL AND ${table.track} IS NOT NULL)`
    ),
    check(
      'time_entry_publication',
      sql`${table.publicationState} IN ('draft', 'published')`
    ),
    check(
      'time_entry_status',
      sql`${table.status} IN ('planned', 'completed', 'cancelled')`
    ),
  ]
)

export const matches = sqliteTable('matches', {
  ...metadata,
  publicationState: text('publication_state')
    .$type<'draft' | 'published'>()
    .notNull()
    .default('published'),
  webhookCapture: text('webhook_capture')
    .unique()
    .references(() => webhookCaptures.id),
  user1DurationMs: integer('user1_duration_ms'),
  user2DurationMs: integer('user2_duration_ms'),
  user1ChugDurationMs: integer('user1_chug_duration_ms'),
  user2ChugDurationMs: integer('user2_chug_duration_ms'),
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

export const tournaments = sqliteTable(
  'tournaments',
  {
    ...metadata,
    session: text()
      .notNull()
      .references(() => sessions.id),
    groupsCount: integer('groups_count').notNull().default(1),
    advancementCount: integer('advancement_count').notNull().default(2),
    eliminationType: text('elimination_type')
      .$type<EliminationType>()
      .notNull()
      .default('single'),
    status: text().$type<TournamentStatus>().notNull().default('started'),
    owner: text().references(() => users.id),
    previewVisibility: text('preview_visibility')
      .$type<PreviewVisibility>()
      .notNull()
      .default('visible'),
    tieBreakerTrack: text('tie_breaker_track').references(() => tracks.id),
    frozenAt: integer('frozen_at', { mode: 'timestamp_ms' }),
    notReadyReason: text('not_ready_reason'),
  },
  table => [
    uniqueIndex('active_session_tournament')
      .on(table.session)
      .where(sql`${table.deletedAt} IS NULL`),
  ]
)

export const tournamentStages = sqliteTable(
  'tournament_stages',
  {
    ...metadata,
    tournament: text()
      .notNull()
      .references(() => tournaments.id),
    stage: text().$type<MatchStage>().notNull(),
    tracks: text({ mode: 'json' }).$type<string[]>().notNull(),
  },
  table => [uniqueIndex('tournament_stage').on(table.tournament, table.stage)]
)
export const tournamentGroups = sqliteTable(
  'tournament_groups',
  {
    ...metadata,
    tournament: text()
      .notNull()
      .references(() => tournaments.id),
    name: text().notNull(),
    position: integer().notNull().default(0),
  },
  table => [
    uniqueIndex('tournament_group_position').on(
      table.tournament,
      table.position
    ),
    uniqueIndex('tournament_group_owner').on(table.tournament, table.id),
  ]
)
export const tournamentPlayers = sqliteTable(
  'tournament_players',
  {
    ...metadata,
    tournament: text()
      .notNull()
      .references(() => tournaments.id),
    user: text()
      .notNull()
      .references(() => users.id),
    groupId: text('group_id').notNull(),
    admission: integer().notNull(),
    rating: integer().notNull(),
    globalRank: integer('global_rank'),
  },
  table => [
    uniqueIndex('tournament_participant').on(table.tournament, table.user),
    foreignKey({
      columns: [table.tournament, table.groupId],
      foreignColumns: [tournamentGroups.tournament, tournamentGroups.id],
    }),
  ]
)
export const tournamentMatches = sqliteTable(
  'tournament_matches',
  {
    ...metadata,
    tournament: text()
      .notNull()
      .references(() => tournaments.id),
    matchId: text('match_id')
      .notNull()
      .references(() => matches.id),
    groupId: text('group_id'),
    bracket: text().$type<'group' | 'upper' | 'lower' | 'final'>().notNull(),
    round: integer().notNull(),
    order: integer().notNull(),
  },
  table => [
    uniqueIndex('tournament_match_record').on(table.matchId),
    uniqueIndex('tournament_match_order')
      .on(table.tournament, table.order)
      .where(sql`${table.deletedAt} IS NULL`),
    foreignKey({
      columns: [table.tournament, table.groupId],
      foreignColumns: [tournamentGroups.tournament, tournamentGroups.id],
    }),
    check(
      'tournament_match_bracket',
      sql`${table.bracket} IN ('group', 'upper', 'lower', 'final')`
    ),
  ]
)

export const tournamentMatchSlots = sqliteTable(
  'tournament_match_slots',
  {
    ...metadata,
    tournamentMatch: text('tournament_match')
      .notNull()
      .references(() => tournamentMatches.id),
    position: integer().$type<1 | 2>().notNull(),
    kind: text().$type<Slot['kind']>().notNull(),
    slotHolderId: text('slot_holder_id').notNull(),
    rank: integer(),
    overrideUser: text('override_user').references(() => users.id),
  },
  table => [
    uniqueIndex('tournament_match_slot_position').on(
      table.tournamentMatch,
      table.position
    ),
    index('tournament_slot_holder').on(table.kind, table.slotHolderId),
    check('tournament_slot_position', sql`${table.position} IN (1, 2)`),
    check(
      'tournament_slot_kind',
      sql`${table.kind} IN ('player', 'group_rank', 'match_winner', 'match_loser')`
    ),
    check(
      'tournament_slot_rank',
      sql`(${table.kind} = 'group_rank' AND ${table.rank} IS NOT NULL AND ${table.rank} > 0) OR (${table.kind} != 'group_rank' AND ${table.rank} IS NULL)`
    ),
  ]
)
