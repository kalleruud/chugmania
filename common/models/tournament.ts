import type {
  groupPlayers,
  groups,
  tournamentMatches,
  tournaments,
} from '../../backend/database/schema'
import { type UserInfo } from './user'
import { type Match } from './match'

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
  matchData: Match | null
}

export type TournamentData = Tournament & {
  groups: GroupWithPlayers[]
  matches: TournamentMatchWithMatch[]
}

// Request Types

export type CreateTournamentRequest = CreateTournament & {
  type: 'CreateTournamentRequest'
}

export function isCreateTournamentRequest(
  data: any
): data is CreateTournamentRequest {
  if (typeof data !== 'object' || data === null) return false
  return (
    data.type === 'CreateTournamentRequest' && typeof data.name === 'string'
  )
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
