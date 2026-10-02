import { isRecord } from '../utils/utils'
import type { Match, MatchStatus } from './match'
import type { TimeEntry } from './timeEntry'

export type EliminationType = 'single' | 'double'
export type TournamentConfig = {
  session: string
  qualificationTrack: string
  groupsCount: number
  advancementCount: number
  eliminationType: EliminationType
  stageTracks: Record<string, string[]>
}
export type Participant = {
  user: string
  duration: number | null
  sourceEntry: string | null
  rating: number
  admission: number
  groupId: string
}
export type Slot =
  | { kind: 'player'; user: string }
  | { kind: 'group_rank'; groupId: string; rank: number }
  | { kind: 'match_winner' | 'match_loser'; matchId: string }
export type TournamentGroup = { id: string; name: string }
export type TournamentFixture = {
  id: string
  groupId: string | null
  bracket: 'group' | 'upper' | 'lower' | 'final'
  round: number
  order: number
  slot1: Slot
  slot2: Slot
  reset: 'none' | 'conditional' | 'required' | 'unneeded'
  match: Match
}
export type TournamentState = {
  id: string
  config: TournamentConfig
  participants: Participant[]
  groups: TournamentGroup[]
  fixtures: TournamentFixture[]
  frozenAt: Date | null
  admissionClosedAt: Date | null
  notReadyReason: string | null
  cancelled: boolean
}
export type Standing = {
  user: string
  rank: number
  wins: number
  losses: number
  qualifies: boolean
}
export type TournamentDetails = {
  id: string
  config: TournamentConfig
  frozen: boolean
  cancelled: boolean
  notReadyReason: string | null
  qualification: (Participant & {
    rank: number
    gapLeader: number | null
    gapPrevious: number | null
  })[]
  qualificationEntries: TimeEntry[]
  groups: (TournamentGroup & { standings: Standing[] })[]
  matches: Match[]
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
    qualificationLaps: number
    minMatches: number
    maxMatches: number
  }
}
export type TournamentRequest = { session: string }
export type DeleteTournamentRequest = TournamentRequest & {
  deleteRelatedResults: boolean
}
export type TournamentChange = {
  session: string
  details: TournamentDetails | null
  actor: string | null
}
export type MatchResult = { status: MatchStatus; winner: string | null }

export function isTournamentRequest(
  value: unknown
): value is TournamentRequest {
  return isRecord(value) && typeof value.session === 'string'
}
export function isTournamentConfig(value: unknown): value is TournamentConfig {
  return (
    isRecord(value) &&
    typeof value.session === 'string' &&
    typeof value.qualificationTrack === 'string' &&
    Number.isInteger(value.groupsCount) &&
    Number.isInteger(value.advancementCount) &&
    (value.eliminationType === 'single' ||
      value.eliminationType === 'double') &&
    isRecord(value.stageTracks) &&
    Object.values(value.stageTracks).every(
      tracks =>
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
