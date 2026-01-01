import type {
  groupPlayers,
  groups,
  tournamentMatches,
  tournaments,
} from '../../backend/database/schema'
import type { Match } from './match'
import type { UserInfo } from './user'

export type Tournament = typeof tournaments.$inferSelect
export type CreateTournament = typeof tournaments.$inferInsert

export type TournamentGroup = typeof groups.$inferSelect
export type TournamentGroupPlayer = Omit<
  typeof groupPlayers.$inferSelect,
  'user'
> & {
  user: UserInfo
}

export type TournamentGroupWithPlayers = TournamentGroup & {
  players: TournamentGroupPlayer[]
}

export type TournamentMatch = typeof tournamentMatches.$inferSelect

export type TournamentWithStructure = Tournament & {
  groups: TournamentGroupWithPlayers[]
  tournamentMatches: TournamentMatch[]
}

export type CreateTournamentRequest = Omit<
  CreateTournament,
  'createdAt' | 'updatedAt' | 'deletedAt'
> & {
  type: 'CreateTournamentRequest'
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

export type EditTournamentRequest = Partial<CreateTournamentRequest> & {
  type: 'EditTournamentRequest'
  id: Tournament['id']
}

export function isEditTournamentRequest(
  data: any
): data is EditTournamentRequest {
  if (typeof data !== 'object' || data === null) return false
  return data.type === 'EditTournamentRequest' && typeof data.id === 'string'
}

export type DeleteTournamentRequest = {
  type: 'DeleteTournamentRequest'
  id: Tournament['id']
}

export function isDeleteTournamentRequest(
  data: any
): data is DeleteTournamentRequest {
  if (typeof data !== 'object' || data === null) return false
  return data.type === 'DeleteTournamentRequest' && typeof data.id === 'string'
}

export type TournamentMatchDisplayData =
  | { kind: 'active'; match: Match }
  | { kind: 'pending'; labelA: string; labelB: string }
