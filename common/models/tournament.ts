import type {
  EliminationType,
  groupPlayers,
  groups,
  tournaments,
  tournamentMatches,
} from '../../backend/database/schema'
import type { Match } from './match'
import type { Ranking } from './ranking'
import type { Session } from './session'
import type { SuccessResponse } from './socket.io'
import type { Track } from './track'
import type { UserInfo } from './user'

export type Tournament = typeof tournaments.$inferSelect
export type TournamentGroup = typeof groups.$inferSelect
export type TournamentGroupPlayer = typeof groupPlayers.$inferSelect
export type TournamentMatchRecord = typeof tournamentMatches.$inferSelect

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0
}

export type CreateTournamentRequest = {
  type: 'CreateTournamentRequest'
  sessionId: Session['id']
  name: string
  description?: string | null
  qualificationTrack: Track['id']
  tournamentTrack: Track['id']
  groupsCount: number
  advancementCount: number
  eliminationType?: EliminationType
}

export function isCreateTournamentRequest(
  data: unknown
): data is CreateTournamentRequest {
  if (!isRecord(data)) return false

  return (
    data.type === 'CreateTournamentRequest' &&
    typeof data.sessionId === 'string' &&
    typeof data.name === 'string' &&
    typeof data.qualificationTrack === 'string' &&
    typeof data.tournamentTrack === 'string' &&
    isPositiveInteger(data.groupsCount) &&
    isPositiveInteger(data.advancementCount) &&
    (data.description === undefined ||
      data.description === null ||
      typeof data.description === 'string') &&
    (data.eliminationType === undefined || data.eliminationType === 'single')
  )
}

export type GetTournamentDetailsRequest = {
  type: 'GetTournamentDetailsRequest'
  sessionId: Session['id']
}

export function isGetTournamentDetailsRequest(
  data: unknown
): data is GetTournamentDetailsRequest {
  if (!isRecord(data)) return false

  return (
    data.type === 'GetTournamentDetailsRequest' &&
    typeof data.sessionId === 'string'
  )
}

export type TournamentParticipantRanking = {
  user: UserInfo
  qualificationRank: number
  qualificationDuration: number | null
  globalRanking: Ranking['ranking'] | null
}

export type TournamentStanding = {
  user: UserInfo
  qualificationRank: number
  wins: number
  losses: number
  matchesPlayed: number
  advanced: boolean
}

export type TournamentGroupDetails = {
  group: TournamentGroup
  players: TournamentParticipantRanking[]
  standings: TournamentStanding[]
}

export type TournamentSlotDependency =
  | {
      type: 'group_rank'
      groupId: TournamentGroup['id']
      groupName: TournamentGroup['name']
      rank: number
    }
  | {
      type: 'match_winner'
      tournamentMatchId: TournamentMatchRecord['id']
      matchName: TournamentMatchRecord['name']
    }

export type TournamentSlotLabel = {
  userId: UserInfo['id'] | null
  label: string
}

export type TournamentMatchDetails = {
  tournamentMatch: TournamentMatchRecord
  match: Match
  slotA: TournamentSlotDependency | null
  slotB: TournamentSlotDependency | null
  slotLabelA: TournamentSlotLabel
  slotLabelB: TournamentSlotLabel
}

export type TournamentProgressSummary = {
  groupMatchesCompleted: number
  groupMatchesTotal: number
  bracketMatchesCompleted: number
  bracketMatchesTotal: number
  resolvedBracketSlots: number
  totalBracketSlots: number
}

export type TournamentWorkloadSummary = {
  participantCount: number
  totalScheduledMatches: number
  groupStageMatches: number
  bracketStageMatches: number
}

export type TournamentDetails = {
  tournament: Tournament
  session: Session
  qualificationTrack: Track
  tournamentTrack: Track | null
  participants: TournamentParticipantRanking[]
  groups: TournamentGroupDetails[]
  groupMatches: TournamentMatchDetails[]
  bracketMatches: TournamentMatchDetails[]
  progress: TournamentProgressSummary
  workload: TournamentWorkloadSummary
}

export type CreateTournamentResponse = SuccessResponse & {
  tournament: TournamentDetails
}

export type GetTournamentDetailsResponse = SuccessResponse & {
  tournament: TournamentDetails | null
}
