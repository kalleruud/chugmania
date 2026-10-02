import loc from '@common/locale/locales'
import type { Match } from '@common/models/match'
import type {
  Participant,
  Slot,
  Standing,
  TournamentFixture,
  TournamentState,
} from '@common/models/tournament'

export function sportingOrder(a: Participant, b: Participant): number {
  if (a.duration !== null && b.duration === null) return -1
  if (a.duration === null && b.duration !== null) return 1
  return (a.duration ?? 0) - (b.duration ?? 0) || b.rating - a.rating
}
export function qualificationOrder(a: Participant, b: Participant): number {
  return sportingOrder(a, b) || a.user.localeCompare(b.user)
}
export function decided(match: Match): boolean {
  return (
    (match.status === 'completed' || match.status === 'cancelled') &&
    !!match.user1 &&
    !!match.user2 &&
    match.user1 !== match.user2 &&
    (match.winner === match.user1 || match.winner === match.user2)
  )
}
function directMatchOrder(
  fixtures: TournamentFixture[]
): (a: string, b: string) => number {
  const winners = new Map<string, string>()
  const pair = (a: string, b: string) => [a, b].sort().join(':')
  const timestamp = (fixture: TournamentFixture) =>
    new Date(
      fixture.playedAt ?? fixture.match.updatedAt ?? fixture.match.createdAt
    ).getTime()
  for (const fixture of fixtures
    .filter(fixture => !fixture.match.deletedAt && decided(fixture.match))
    .toSorted(
      (a, b) =>
        timestamp(a) - timestamp(b) ||
        a.order - b.order ||
        a.id.localeCompare(b.id)
    )) {
    const match = fixture.match
    if (match.user1 && match.user2 && match.winner)
      winners.set(pair(match.user1, match.user2), match.winner)
  }
  return (a, b) => {
    const winner = winners.get(pair(a, b))
    if (!winner) return 0
    return winner === a ? -1 : 1
  }
}
function orderTies<T extends { user: string }>(
  rows: T[],
  primary: (a: T, b: T) => number,
  fallback: (a: T, b: T) => number,
  direct: (a: string, b: string) => number
): T[] {
  // ponytail: cubic within a tie; precompute incoming edges if fields grow large
  const sorted = rows.toSorted(
    (a, b) => primary(a, b) || fallback(a, b) || a.user.localeCompare(b.user)
  )
  const result: T[] = []
  for (let start = 0; start < sorted.length; ) {
    let end = start + 1
    while (end < sorted.length && primary(sorted[start], sorted[end]) === 0)
      end++
    const tied = sorted.slice(start, end)
    while (tied.length) {
      const index = tied.findIndex(
        player =>
          !tied.some(
            other =>
              other.user !== player.user && direct(other.user, player.user) < 0
          )
      )
      const [next] = tied.splice(Math.max(0, index), 1)
      result.push(next)
    }
    start = end
  }
  return result
}
export function groupStandings(
  state: TournamentState,
  groupId: string
): Standing[] {
  const players = state.participants
    .filter(p => p.groupId === groupId)
    .toSorted(qualificationOrder)
  const rank = new Map(players.map((p, index) => [p.user, index]))
  const results = state.fixtures.filter(
    f =>
      f.groupId === groupId &&
      decided(f.match) &&
      players.some(p => p.user === f.match.user1) &&
      players.some(p => p.user === f.match.user2)
  )
  const rows = players.map(p => ({
    user: p.user,
    rank: 0,
    wins: results.filter(f => f.match.winner === p.user).length,
    losses: results.filter(
      f =>
        (f.match.user1 === p.user || f.match.user2 === p.user) &&
        f.match.winner !== p.user
    ).length,
    qualifies: false,
  }))
  return orderTies(
    rows,
    (a, b) => b.wins - a.wins,
    (a, b) =>
      a.losses - b.losses || (rank.get(a.user) ?? 0) - (rank.get(b.user) ?? 0),
    directMatchOrder(results)
  ).map((row, index) => ({
    ...row,
    rank: index + 1,
    qualifies: index < state.config.advancementCount,
  }))
}
export function groupComplete(state: TournamentState): boolean {
  return state.fixtures
    .filter(f => f.bracket === 'group')
    .every(f => decided(f.match))
}
export function resolveSlots(state: TournamentState): TournamentState {
  const result = structuredClone(state)
  const standings = new Map(
    result.groups.map(group => [group.id, groupStandings(result, group.id)])
  )
  const groupsDone = groupComplete(result)
  const resolve = (slot: Slot): string | null => {
    if (slot.kind === 'player') return slot.user
    if (slot.kind === 'group_rank')
      return groupsDone
        ? (standings.get(slot.groupId)?.find(row => row.rank === slot.rank)
            ?.user ?? null)
        : null
    const match = result.fixtures.find(f => f.id === slot.matchId)?.match
    if (!match || !decided(match)) return null
    if (slot.kind === 'match_winner') return match.winner
    return match.winner === match.user1 ? match.user2 : match.user1
  }
  for (let pass = 0; pass <= result.fixtures.length; pass++) {
    let changed = false
    for (const fixture of result.fixtures) {
      if (fixture.reset !== 'none') {
        const grandFinal = result.fixtures.find(
          f => f.match.stage === 'grand_final'
        )?.match
        let reset: typeof fixture.reset = 'conditional'
        if (grandFinal && decided(grandFinal))
          reset =
            grandFinal.winner === grandFinal.user2 ? 'required' : 'unneeded'
        if (reset !== fixture.reset) changed = true
        fixture.reset = reset
      }
      const inactive =
        fixture.reset === 'conditional' || fixture.reset === 'unneeded'
      const user1 = inactive ? null : resolve(fixture.slot1)
      const user2 = inactive ? null : resolve(fixture.slot2)
      if (fixture.match.user1 !== user1 || fixture.match.user2 !== user2)
        changed = true
      fixture.match.user1 = user1
      fixture.match.user2 = user2
    }
    if (!changed) return result
  }
  throw new Error(loc.no.tournament.invalid)
}
export function protectResults(
  before: TournamentState,
  after: TournamentState,
  editing: string
): void {
  const affected = before.fixtures.filter(
    f =>
      f.id !== editing &&
      decided(f.match) &&
      after.fixtures.some(
        next =>
          next.id === f.id &&
          (next.match.user1 !== f.match.user1 ||
            next.match.user2 !== f.match.user2 ||
            next.reset !== f.reset)
      )
  )
  if (affected.length)
    throw new Error(
      loc.no.tournament.downstream +
        affected
          .map(
            f => f.match.tournament?.label ?? `${f.match.stage} ${f.order + 1}`
          )
          .join(', ')
    )
}
export function overallStandings(state: TournamentState): {
  rows: { user: string; rank: number }[]
  completed: boolean
} {
  if (state.config.eliminationType === 'round_robin')
    return {
      completed: state.fixtures.length > 0 && groupComplete(state),
      rows: groupStandings(state, state.groups[0].id).map(row => ({
        user: row.user,
        rank: row.rank,
      })),
    }
  const final = state.fixtures
    .filter(
      f =>
        f.bracket !== 'group' &&
        f.reset !== 'unneeded' &&
        f.reset !== 'conditional'
    )
    .at(-1)
  const completed =
    !!final &&
    decided(final.match) &&
    (!state.fixtures.some(f => f.reset === 'required') ||
      final.match.stage === 'grand_final_reset')
  const groups = state.groups.flatMap(g => groupStandings(state, g.id))
  const bracket = state.fixtures.filter(f => f.bracket !== 'group')
  const score = (p: Participant): number => {
    if (completed && final.match.winner === p.user) return 10000
    if (
      completed &&
      (final.match.user1 === p.user || final.match.user2 === p.user)
    )
      return 9999
    const loss = bracket
      .filter(
        f =>
          decided(f.match) &&
          (state.config.eliminationType === 'single' ||
            f.bracket === 'lower') &&
          f.match.winner !== p.user &&
          (f.match.user1 === p.user || f.match.user2 === p.user)
      )
      .at(-1)
    if (loss) return 100 + loss.round
    if (groups.find(row => row.user === p.user)?.qualifies) return 99
    return 0
  }
  const percentage = (user: string): number => {
    const row = groups.find(r => r.user === user)
    return row && row.wins + row.losses ? row.wins / (row.wins + row.losses) : 0
  }
  const primary = (a: Participant, b: Participant) =>
    score(b) - score(a) ||
    (score(a) === 0 ? percentage(b.user) - percentage(a.user) : 0)
  const direct = directMatchOrder(state.fixtures)
  const compare = (a: Participant, b: Participant) =>
    primary(a, b) || direct(a.user, b.user) || sportingOrder(a, b)
  const ordered = orderTies(state.participants, primary, sportingOrder, direct)
  let place = 0
  return {
    completed,
    rows: ordered.map((p, i) => {
      if (i === 0 || compare(ordered[i - 1], p) !== 0) place = i + 1
      return { user: p.user, rank: place }
    }),
  }
}
