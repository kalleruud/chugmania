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
import type { UserInfo } from './user'

export type Tournament = typeof tournaments.$inferSelect
export type CreateTournament = typeof tournaments.$inferInsert

export type Group = typeof groups.$inferSelect
export type CreateGroup = typeof groups.$inferInsert

export type GroupPlayer = typeof groupPlayers.$inferSelect
export type CreateGroupPlayer = typeof groupPlayers.$inferInsert

export type TournamentMatch = typeof tournamentMatches.$inferSelect
export type CreateTournamentMatch = typeof tournamentMatches.$inferInsert

export type GroupPlayerWithUser = Omit<GroupPlayer, 'user'> & {
  user: UserInfo
  wins: number
  losses: number
}

export type GroupWithPlayers = Group & {
  players: GroupPlayerWithUser[]
}

export type TournamentMatchWithDetails = TournamentMatch & {
  matchDetails: Match | null
}

export type TournamentWithDetails = Tournament & {
  groups: GroupWithPlayers[]
  matches: TournamentMatchWithDetails[]
}

export type TournamentTrackAssignment = {
  stage: string
  trackId: string
}

export type CreateTournamentRequest = {
  type: 'CreateTournamentRequest'
  session: string
  name: string
  description?: string
  groupsCount: number
  advancementCount: number
  eliminationType: EliminationType
  groupStageTracks: string[]
  bracketTracks: TournamentTrackAssignment[]
}

export function isCreateTournamentRequest(
  data: unknown
): data is CreateTournamentRequest {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  return (
    d.type === 'CreateTournamentRequest' &&
    typeof d.session === 'string' &&
    typeof d.name === 'string' &&
    Array.isArray(d.groupStageTracks) &&
    Array.isArray(d.bracketTracks)
  )
}

export type TournamentPreview = {
  groups: {
    name: string
    players: { id: string; name: string; rating: number; seed: number }[]
  }[]
  bracketStages: { stage: string; matchCount: number }[]
  groupMatchCount: number
  bracketMatchCount: number
  totalMatchCount: number
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
