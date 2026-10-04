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
import type { EliminationType, Slot } from '../../common/models/tournament'

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
  | `round_${number}`
  | 'grand_final_reset'
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
  draft: integer({ mode: 'boolean' }).notNull().default(false),
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
    finalResetStatus: text('final_reset_status')
      .$type<'none' | 'conditional' | 'required' | 'unneeded'>()
      .notNull()
      .default('none'),
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
    check(
      'tournament_match_reset',
      sql`${table.finalResetStatus} IN ('none', 'conditional', 'required', 'unneeded')`
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
