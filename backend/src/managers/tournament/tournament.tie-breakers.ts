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
  const ready = users.every(user => {
    const lap = laps.get(user)
    return (
      lap?.status === 'cancelled' ||
      (lap?.status === 'completed' && (lap.duration ?? 0) > 0)
    )
  })
  if (!ready) return users.map(user => ({ user, rank: 1, resolved: false }))
  const players = new Map(
    state.participants.map(player => [player.user, player])
  )
  const ordered = users.toSorted((a, b) => {
    const lapA = laps.get(a)
    const lapB = laps.get(b)
    const cancelledA = lapA?.status === 'cancelled'
    const cancelledB = lapB?.status === 'cancelled'
    if (cancelledA !== cancelledB) return cancelledA ? 1 : -1
    const duration = (lapA?.duration ?? 0) - (lapB?.duration ?? 0)
    if (!cancelledA && duration) return duration
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
  return ordered.map((user, index) => ({
    user,
    rank:
      !required && firstCancelled >= 0 && index >= firstCancelled
        ? firstCancelled + 1
        : index + 1,
    resolved:
      required ||
      laps.get(user)?.status !== 'cancelled' ||
      firstCancelled === ordered.length - 1,
  }))
}
