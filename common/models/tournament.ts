import type {
  EliminationType,
  groupPlayers,
  groups,
  matchDependencies,
  stages,
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

export type Stage = typeof stages.$inferSelect
export type CreateStage = typeof stages.$inferInsert

export type MatchDependency = typeof matchDependencies.$inferSelect
export type CreateMatchDependency = typeof matchDependencies.$inferInsert

export type MatchWithTournamentDetails = Omit<Match, 'stage' | 'index'> & {
  stage: string
  index: number
  dependencyNames: {
    A: string
    B: string
  } | null
}

export type TournamentStage = {
  stage: Stage
  matches: MatchWithTournamentDetails[]
}

export type GroupPlayerWithStats = GroupPlayer & {
  wins: number
  losses: number
}

export type GroupWithPlayers = Group & {
  players: GroupPlayerWithStats[]
}

export type TournamentWithDetails = Tournament & {
  maxMatchesPerPlayer: number
  minMatchesPerPlayer: number
  groupStageTrackCount: number
  groups: GroupWithPlayers[]
  stages: TournamentStage[]
}

export type CreateTournamentRequest = {
  type: 'CreateTournamentRequest'
  session: string
  name: string
  description?: string
  groupsCount: number
  advancementCount: number
  eliminationType: EliminationType
  groupStageTracks?: string[]
  bracketTracks?: string[]
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

export type TournamentPreviewResponse = SuccessResponse & {
  tournament: TournamentWithDetails
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
