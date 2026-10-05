import type { MatchStage } from '../../backend/database/schema'
import { isRecord } from '../utils/utils'
import type { Match, MatchStatus } from './match'
import type { TimeEntry } from './timeEntry'

export type EliminationType = 'single' | 'double'
export type TournamentStatus = 'draft' | 'started'
export type TournamentConfig = {
  session: string
  groupsCount: number
  advancementCount: number
  eliminationType: EliminationType
  stageTracks: Partial<Record<MatchStage, string[]>>
  tieBreakerTrack: string | null
}

export type Participant = {
  user: string
  rating: number
  globalRank: number | null
  admission: number
  groupId: string
}

export type Slot = (
  | { kind: 'player'; user: string }
  | { kind: 'group_rank'; groupId: string; rank: number }
  | { kind: 'match_winner' | 'match_loser'; matchId: string }
) & { override?: string }

export type TournamentGroup = { id: string; name: string; position: number }

export type TournamentFixture = {
  id: string
  groupId: string | null
  bracket: 'group' | 'upper' | 'lower' | 'final'
  round: number
  order: number
  slot1: Slot
  slot2: Slot
  match: Match
}

export type TournamentState = {
  id: string
  config: TournamentConfig
  participants: Participant[]
  groups: TournamentGroup[]
  fixtures: TournamentFixture[]
  tieBreakers: TimeEntry[]
  frozenAt: Date | null
  notReadyReason: string | null
  cancelled: boolean
}

export type Standing = {
  user: string
  rank: number
  wins: number
  losses: number
  matchesPlayed: number
  winPercentage: number
  explanation: 'head_to_head' | 'tie_breaker' | null
  qualifies: boolean
  resolved: boolean
}

export type TournamentDetails = {
  status: TournamentStatus
  configKey: string | null
  previewKey: string | null
  id: string
  config: TournamentConfig
  frozen: boolean
  cancelled: boolean
  notReadyReason: string | null
  participants: Participant[]
  groups: (TournamentGroup & {
    code: string
    standings: Standing[]
    progress: { decided: number; total: number }
  })[]
  matches: Match[]
  tieBreakers: (TimeEntry & { required: boolean })[]
  standings: { user: string; rank: number }[]
  completed: boolean
  progress: {
    decided: number
    total: number
    groupDecided: number
    groupTotal: number
  }
  workloadSummary: {
    tracks: number
    minMatches: number
    maxMatches: number
  }
}

export type TournamentRequest = { session: string }

export type UpdateTournamentRequest = {
  config: TournamentConfig
  configKey: string
}

export type StartTournamentRequest = TournamentRequest & { previewKey: string }

export type TournamentConflictResponse = {
  success: false
  code: 'conflict'
  message: string
  details: TournamentDetails | null
}

export const MAX_TOURNAMENT_GROUP_NAME_LENGTH = 100

export type RenameTournamentGroupRequest = TournamentRequest & {
  groupId: string
  name: string
}

export function isRenameTournamentGroupRequest(
  value: unknown
): value is RenameTournamentGroupRequest {
  return (
    isTournamentRequest(value) &&
    'groupId' in value &&
    typeof value.groupId === 'string' &&
    'name' in value &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    value.name.trim().length <= MAX_TOURNAMENT_GROUP_NAME_LENGTH
  )
}

export type DeleteTournamentRequest = TournamentRequest & {
  deleteRelatedResults: boolean
}

export type MatchResult = { status: MatchStatus; winner: string | null }

export function isTournamentRequest(
  value: unknown
): value is TournamentRequest {
  return isRecord(value) && typeof value.session === 'string'
}

export function isMatchStage(value: string): value is MatchStage {
  const stages: string[] = [
    'group',
    'eight',
    'quarter',
    'semi',
    'final',
    'bronze',
    'loser_eight',
    'loser_bronze',
    'loser_quarter',
    'loser_semi',
    'loser_final',
    'grand_final',
    'grand_final_reset',
  ]
  if (stages.includes(value)) return true
  if (!/^round_[1-9]\d*$/.test(value)) return false
  const size = Number(value.slice(6))
  return (
    Number.isSafeInteger(size) &&
    size >= 32 &&
    Number.isInteger(Math.log2(size))
  )
}

export function isTournamentConfig(value: unknown): value is TournamentConfig {
  return (
    isRecord(value) &&
    typeof value.session === 'string' &&
    typeof value.groupsCount === 'number' &&
    Number.isSafeInteger(value.groupsCount) &&
    value.groupsCount > 0 &&
    typeof value.advancementCount === 'number' &&
    Number.isSafeInteger(value.advancementCount) &&
    value.advancementCount > 0 &&
    (value.eliminationType === 'single' ||
      value.eliminationType === 'double') &&
    (value.tieBreakerTrack === null ||
      typeof value.tieBreakerTrack === 'string') &&
    isRecord(value.stageTracks) &&
    Object.entries(value.stageTracks).every(
      ([stage, tracks]) =>
        isMatchStage(stage) &&
        Array.isArray(tracks) &&
        tracks.every((track: unknown) => typeof track === 'string')
    )
  )
}

export function isDeleteTournamentRequest(
  value: unknown
): value is DeleteTournamentRequest {
  return (
    isTournamentRequest(value) &&
    'deleteRelatedResults' in value &&
    typeof value.deleteRelatedResults === 'boolean'
  )
}

export function isUpdateTournamentRequest(
  value: unknown
): value is UpdateTournamentRequest {
  return (
    isRecord(value) &&
    isTournamentConfig(value.config) &&
    typeof value.configKey === 'string'
  )
}

export function isStartTournamentRequest(
  value: unknown
): value is StartTournamentRequest {
  return (
    isTournamentRequest(value) &&
    'previewKey' in value &&
    typeof value.previewKey === 'string'
  )
}
