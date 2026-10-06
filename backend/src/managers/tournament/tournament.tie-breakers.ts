import type { Match } from '@common/models/match'
import type {
  TournamentFixture,
  TournamentState,
} from '@common/models/tournament'
import { isInactiveFinalReset } from '@common/utils/tournament'

export function hasResult(match: Match): boolean {
  return (
    (match.status === 'completed' || match.status === 'cancelled') &&
    !!match.user1 &&
    !!match.user2 &&
    !!match.winner &&
    (match.winner === match.user1 || match.winner === match.user2)
  )
}

export function stageComplete(fixtures: TournamentFixture[]): boolean {
  return fixtures
    .filter(f => !isInactiveFinalReset(f.match))
    .every(({ match }) => hasResult(match))
}

export function rankLapTie(
  state: TournamentState,
  users: string[],
  required: boolean
): { user: string; rank: number; resolved: boolean }[] {
  const laps = new Map(
    state.tieBreakers.filter(lap => !lap.deletedAt).map(lap => [lap.user, lap])
  )
  const lapOrder = (user: string): number => {
    const lap = laps.get(user)
    if (lap?.status === 'completed' && (lap.duration ?? 0) > 0) return 0
    return lap?.status === 'cancelled' ? 2 : 1
  }
  const players = new Map(
    state.participants.map(player => [player.user, player])
  )
  const ordered = users.toSorted(
    (a, b) =>
      lapOrder(a) - lapOrder(b) ||
      (lapOrder(a) === 0
        ? (laps.get(a)?.duration ?? 0) - (laps.get(b)?.duration ?? 0)
        : 0) ||
      (players.get(a)?.globalRank ?? Infinity) -
        (players.get(b)?.globalRank ?? Infinity) ||
      (players.get(a)?.admission ?? 0) - (players.get(b)?.admission ?? 0) ||
      a.localeCompare(b)
  )
  const firstCancelled = ordered.findIndex(
    user => laps.get(user)?.status === 'cancelled'
  )
  const firstPlanned = ordered.findIndex(user => lapOrder(user) === 1)
  return ordered.map((user, index) => {
    if (lapOrder(user) === 1)
      return { user, rank: firstPlanned + 1, resolved: false }
    return {
      user,
      rank:
        !required && firstCancelled >= 0 && index >= firstCancelled
          ? firstCancelled + 1
          : index + 1,
      resolved:
        required ||
        laps.get(user)?.status !== 'cancelled' ||
        firstCancelled === ordered.length - 1,
    }
  })
}
