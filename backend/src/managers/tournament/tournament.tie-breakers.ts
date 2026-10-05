import type {
  TournamentFixture,
  TournamentState,
} from '@common/models/tournament'
import { isInactiveFinalReset } from '@common/utils/tournament'

export function stageComplete(fixtures: TournamentFixture[]): boolean {
  return fixtures
    .filter(f => !isInactiveFinalReset(f.match))
    .every(
      ({ match }) =>
        (match.status === 'completed' || match.status === 'cancelled') &&
        !!match.user1 &&
        !!match.user2 &&
        !!match.winner &&
        (match.winner === match.user1 || match.winner === match.user2)
    )
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
  const ordered = users.toSorted((a, b) => {
    const lapA = laps.get(a)
    const lapB = laps.get(b)
    const orderA = lapOrder(a)
    const orderB = lapOrder(b)
    if (orderA !== orderB) return orderA - orderB
    const duration = (lapA?.duration ?? 0) - (lapB?.duration ?? 0)
    if (orderA === 0 && duration) return duration
    const playerA = players.get(a)
    const playerB = players.get(b)
    return (
      (playerA?.globalRank ?? Infinity) - (playerB?.globalRank ?? Infinity) ||
      (playerA?.admission ?? 0) - (playerB?.admission ?? 0) ||
      a.localeCompare(b)
    )
  })
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
