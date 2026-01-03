import type {
  EliminationType,
  groupPlayers,
  groups,
  MatchProgression,
  TournamentBracket,
  tournamentMatches,
  tournaments,
} from '../../backend/database/schema'
import type { SuccessResponse } from './socket.io'

export type Tournament = typeof tournaments.$inferSelect
export type CreateTournament = typeof tournaments.$inferInsert

export type Group = typeof groups.$inferSelect
export type CreateGroup = typeof groups.$inferInsert

export type GroupPlayer = typeof groupPlayers.$inferSelect
export type CreateGroupPlayer = typeof groupPlayers.$inferInsert

type TournamentMatchBase = typeof tournamentMatches.$inferSelect
export type TournamentMatch = Omit<
  TournamentMatchBase,
  | 'sourceGroupA'
  | 'sourceGroupB'
  | 'sourceGroupARank'
  | 'sourceGroupBRank'
  | 'sourceMatchA'
  | 'sourceMatchB'
  | 'sourceMatchAProgression'
  | 'sourceMatchBProgression'
  | 'bracket'
  | 'round'
> &
  (
    | {
        bracket: 'group'
        round: undefined
      }
    | {
        bracket: Omit<TournamentMatchBase['bracket'], 'group'>
        round: number
      }
  ) &
  (
    | {
        sourceGroupIdA: TournamentMatchBase['sourceGroupA']
        sourceGroupIdB: TournamentMatchBase['sourceGroupB']
        sourceGroupRankA: TournamentMatchBase['sourceGroupARank']
        sourceGroupRankB: TournamentMatchBase['sourceGroupBRank']
      }
    | {
        sourceMatchIdA: TournamentMatchBase['sourceMatchA']
        sourceMatchIdB: TournamentMatchBase['sourceMatchB']
        sourceMatchProgressionA: TournamentMatchBase['sourceMatchAProgression']
        sourceMatchProgressionB: TournamentMatchBase['sourceMatchBProgression']
      }
  )
export type CreateTournamentMatch = typeof tournamentMatches.$inferInsert

export type TournamentWithDetails = Tournament & {
  groups: GroupWithPlayers[]
  matches: TournamentMatch[]
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

export type TournamentPreview = Omit<
  TournamentWithDetails,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
>

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
