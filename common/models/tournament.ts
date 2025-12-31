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

export type Group = typeof groups.$inferSelect
export type CreateGroup = typeof groups.$inferInsert

export type GroupPlayer = typeof groupPlayers.$inferSelect
export type CreateGroupPlayer = typeof groupPlayers.$inferInsert

export type TournamentMatch = typeof tournamentMatches.$inferSelect
export type CreateTournamentMatch = typeof tournamentMatches.$inferInsert

export type EliminationType = 'single' | 'double'
export type TournamentBracket = 'group' | 'upper' | 'lower'
export type MatchProgression = 'winner' | 'loser'

export type GroupWithPlayers = Group & {
  players: (GroupPlayer & { user: UserInfo })[]
}

export type TournamentMatchWithMatch = TournamentMatch & {
  match: Match | null
}

export type TournamentWithDetails = Tournament & {
  groups: GroupWithPlayers[]
  tournamentMatches: TournamentMatchWithMatch[]
}

export type CreateTournamentRequest = {
  type: 'CreateTournamentRequest'
} & CreateTournament

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
    (data.eliminationType === 'single' || data.eliminationType === 'double')
  )
}

export type EditTournamentRequest = Partial<CreateTournament> & {
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
