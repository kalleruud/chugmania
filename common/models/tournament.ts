import type {
  EliminationType,
  groupPlayers,
  groups,
  MatchProgression,
  TournamentBracket,
  tournamentMatches,
  tournaments,
} from '../../backend/database/schema'
import type { Match } from './match'
import type { SuccessResponse } from './socket.io'

export type Tournament = typeof tournaments.$inferSelect
export type CreateTournament = typeof tournaments.$inferInsert

export type Group = typeof groups.$inferSelect
export type CreateGroup = typeof groups.$inferInsert

export type GroupPlayer = typeof groupPlayers.$inferSelect
export type CreateGroupPlayer = typeof groupPlayers.$inferInsert

export type TournamentMatch = typeof tournamentMatches.$inferSelect
export type CreateTournamentMatch = typeof tournamentMatches.$inferInsert

export type TournamentMatchWithDetails = TournamentMatch & {
  matchDetails?: Match
}

export type BracketRound = {
  bracket: TournamentMatch['bracket']
  round: number
  matches: TournamentMatch[]
}

export type TournamentWithDetails = Tournament & {
  groups: GroupWithPlayers[]
  matches: TournamentMatch[]
  matchesByRound: BracketRound[]
}

export type GroupWithPlayers = Group & {
  players: GroupPlayerWithStats[]
}

export type GroupPlayerWithStats = {
  user: GroupPlayer['user']
  seed: GroupPlayer['seed']
  wins: number
  losses: number
}

export type CreateTournamentRequest = {
  type: 'CreateTournamentRequest'
  session: string
  name: string
  description?: string
  groupsCount: number
  advancementCount: number
  eliminationType: EliminationType
  groupStageTracks?: string[] // tracks to cycle through rounds
}

export function isCreateTournamentRequest(
  data: unknown
): data is CreateTournamentRequest {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  return (
    d.type === 'CreateTournamentRequest' &&
    typeof d.session === 'string' &&
    typeof d.name === 'string'
  )
}

export type TournamentPreview = Omit<
  TournamentWithDetails,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
> & {
  groupStageRounds: number
}

export type TournamentPreviewResponse = SuccessResponse & {
  tournament: TournamentPreview
}

export type TournamentPreviewRequest = Omit<CreateTournamentRequest, 'type'> & {
  type: 'TournamentPreviewRequest'
}

export function isTournamentPreviewRequest(
  data: any
): data is TournamentPreviewRequest {
  if (typeof data !== 'object' || data === null || data === undefined)
    return false
  return (
    data.type === 'TournamentPreviewRequest' &&
    typeof data.name === 'string' &&
    typeof data.groupsCount === 'number' &&
    typeof data.advancementCount === 'number' &&
    typeof data.eliminationType === 'string'
  )
}

export type EditTournamentRequest = {
  type: 'EditTournamentRequest'
  id: string
  name?: string
  description?: string
  groupsCount?: number
  advancementCount?: number
  eliminationType?: EliminationType
}

export function isEditTournamentRequest(
  data: unknown
): data is EditTournamentRequest {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  return d.type === 'EditTournamentRequest' && typeof d.id === 'string'
}

export type DeleteTournamentRequest = {
  type: 'DeleteTournamentRequest'
  id: string
}

export function isDeleteTournamentRequest(
  data: unknown
): data is DeleteTournamentRequest {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  return d.type === 'DeleteTournamentRequest' && typeof d.id === 'string'
}

export type TournamentBracketType = TournamentBracket
export type TournamentEliminationType = EliminationType
export type TournamentMatchProgressionType = MatchProgression
