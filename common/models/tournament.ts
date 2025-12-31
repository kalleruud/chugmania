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
}

export type GroupWithPlayers = Group & {
  players: GroupPlayerWithUser[]
}

export type TournamentMatchWithMatch = TournamentMatch & {
  match?: Match | null
}

export type TournamentWithDetails = Tournament & {
  groups: GroupWithPlayers[]
  tournamentMatches: TournamentMatchWithMatch[]
}

export type CreateTournamentRequest = {
  type: 'CreateTournamentRequest'
  session: string
  name: string
  description?: string
  groupsCount: number
  advancementCount: number
  eliminationType: EliminationType
}

export function isCreateTournamentRequest(
  data: any
): data is CreateTournamentRequest {
  if (typeof data !== 'object' || data === null) return false
  return (
    data.type === 'CreateTournamentRequest' &&
    typeof data.session === 'string' &&
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
  data: any
): data is EditTournamentRequest {
  if (typeof data !== 'object' || data === null) return false
  return data.type === 'EditTournamentRequest' && typeof data.id === 'string'
}

export type DeleteTournamentRequest = {
  type: 'DeleteTournamentRequest'
  id: string
}

export function isDeleteTournamentRequest(
  data: any
): data is DeleteTournamentRequest {
  if (typeof data !== 'object' || data === null) return false
  return data.type === 'DeleteTournamentRequest' && typeof data.id === 'string'
}

export { type EliminationType, type MatchProgression, type TournamentBracket }
