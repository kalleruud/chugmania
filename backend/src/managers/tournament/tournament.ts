import loc from '@common/locale/locales'
import type { EditMatchRequest, Match } from '@common/models/match'
import type {
  Participant,
  Slot,
  Standing,
  TournamentDetails,
  TournamentFixture,
  TournamentState,
} from '@common/models/tournament'
import { isInactiveFinalReset } from '@common/utils/tournament'
import { rankLapTie, stageComplete } from './tournament.tie-breakers'

const STANDING_PRIORITY = {
  CHAMPION: 10000,
  RUNNER_UP: 9999,
  ELIMINATED: 100,
  QUALIFIED: 99,
  GROUP_ONLY: 0,
}

export function seedingOrder(a: Participant, b: Participant): number {
  return b.rating - a.rating || a.user.localeCompare(b.user)
}

function headToHead(matches: Match[], a: string, b: string): string | null {
  const match = matches.findLast(
    match =>
      decided(match) &&
      ((match.user1 === a && match.user2 === b) ||
        (match.user1 === b && match.user2 === a))
  )
  return match?.winner ?? null
}

function rankTiedPlayers(
  users: string[],
  matches: Match[],
  lapTie?: (
    users: string[],
    offset: number
  ) => { user: string; rank: number; resolved: boolean }[]
): { user: string; rank: number; resolved: boolean }[] {
  const remaining = [...users]
  const rows: { user: string; rank: number; resolved: boolean }[] = []
  while (remaining.length) {
    const winner = remaining.find(user =>
      remaining.every(
        other => user === other || headToHead(matches, user, other) === user
      )
    )
    if (!winner) {
      const tied = lapTie
        ? lapTie(remaining, rows.length)
        : remaining.map(user => ({ user, rank: 1, resolved: false }))
      return [
        ...rows,
        ...tied.map(row => ({ ...row, rank: rows.length + row.rank })),
      ]
    }
    rows.push({ user: winner, rank: rows.length + 1, resolved: true })
    remaining.splice(remaining.indexOf(winner), 1)
  }
  return rows
}

function decided(match: Match): boolean {
  return (
    (match.status === 'completed' || match.status === 'cancelled') &&
    !!match.user1 &&
    !!match.user2 &&
    match.user1 !== match.user2 &&
    (match.winner === match.user1 || match.winner === match.user2)
  )
}

function groupStandings(
  state: TournamentState,
  groupId: string,
  applyLaps = true
): Standing[] {
  const players = state.participants
    .filter(p => p.groupId === groupId)
    .toSorted(seedingOrder)
  const results = state.fixtures.filter(
    f =>
      f.bracket === 'group' &&
      f.groupId === groupId &&
      decided(f.match) &&
      players.some(p => p.user === f.match.user1) &&
      players.some(p => p.user === f.match.user2)
  )
  const rows = players
    .map(p => ({
      user: p.user,
      rank: 0,
      wins: results.filter(f => f.match.winner === p.user).length,
      losses: results.filter(
        f =>
          (f.match.user1 === p.user || f.match.user2 === p.user) &&
          f.match.winner !== p.user
      ).length,
      qualifies: false,
      resolved: false,
    }))
    .sort((a, b) => winRatio(b) - winRatio(a))
  const standings: Standing[] = []
  for (let start = 0; start < rows.length; ) {
    const tied = rows.filter(row => winRatio(row) === winRatio(rows[start]))
    for (const place of rankTiedPlayers(
      tied.map(row => row.user),
      results.map(f => f.match),
      applyLaps && groupComplete(state)
        ? (users, offset) =>
            rankLapTie(
              state,
              users,
              start + offset + 1 <= state.config.advancementCount
            )
        : undefined
    )) {
      const row = tied.find(row => row.user === place.user)
      if (row)
        standings.push({
          ...row,
          ...place,
          rank: start + place.rank,
          qualifies:
            place.resolved &&
            start + place.rank <= state.config.advancementCount,
        })
    }
    start += tied.length
  }
  return standings
}

function groupComplete(state: TournamentState): boolean {
  return state.fixtures
    .filter(f => f.bracket === 'group')
    .every(f => decided(f.match))
}

function winRatio(row: Pick<Standing, 'wins' | 'losses'>): number {
  return row.wins / (row.wins + row.losses || 1)
}

export function resolveTournament(state: TournamentState): TournamentState {
  const result = structuredClone(state)
  const standings = new Map(
    result.groups.map(group => [group.id, groupStandings(result, group.id)])
  )
  const groupsDone = groupComplete(result)
  const resolve = (slot: Slot): string | null => {
    if (slot.override) return slot.override
    if (slot.kind === 'player') return slot.user
    if (slot.kind === 'group_rank')
      return groupsDone
        ? (standings
            .get(slot.groupId)
            ?.find(row => row.rank === slot.rank && row.resolved)?.user ?? null)
        : null
    const match = result.fixtures.find(f => f.id === slot.matchId)?.match
    if (!match || !decided(match)) return null
    if (slot.kind === 'match_winner') return match.winner
    return match.winner === match.user1 ? match.user2 : match.user1
  }
  const grandFinal = result.fixtures.find(
    f => f.match.stage === 'grand_final'
  )?.match
  for (let pass = 0; pass <= result.fixtures.length; pass++) {
    let changed = false
    for (const fixture of result.fixtures) {
      const inactive =
        fixture.match.stage === 'grand_final_reset' &&
        (!grandFinal ||
          !decided(grandFinal) ||
          grandFinal.winner !== grandFinal.user2)
      if (inactive) {
        const status =
          grandFinal && decided(grandFinal) ? 'cancelled' : 'planned'
        if (fixture.match.status !== status || fixture.match.winner)
          changed = true
        fixture.match.status = status
        fixture.match.winner = null
      } else if (
        isInactiveFinalReset(fixture.match) &&
        fixture.match.status === 'cancelled'
      ) {
        fixture.match.status = 'planned'
        changed = true
      }
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
  editing = ''
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
            next.match.status !== f.match.status)
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

function overallStandings(
  state: TournamentState,
  applyLaps = true
): {
  rows: { user: string; rank: number }[]
  completed: boolean
  needs: string[][]
} {
  const final = state.fixtures
    .filter(f => !isInactiveFinalReset(f.match))
    .at(-1)
  const completed = !!final && decided(final.match)
  const groups = state.groups.flatMap(g => groupStandings(state, g.id))
  const bracket = state.fixtures.filter(f => f.bracket !== 'group')
  const score = (p: Participant): number => {
    if (completed && final.match.winner === p.user)
      return STANDING_PRIORITY.CHAMPION
    if (
      completed &&
      (final.match.user1 === p.user || final.match.user2 === p.user)
    )
      return STANDING_PRIORITY.RUNNER_UP
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
    if (loss) return STANDING_PRIORITY.ELIMINATED + loss.round
    if (groups.find(row => row.user === p.user)?.qualifies)
      return STANDING_PRIORITY.QUALIFIED
    return STANDING_PRIORITY.GROUP_ONLY
  }
  const percentage = (user: string): number => {
    const row = groups.find(r => r.user === user)
    return row && row.wins + row.losses ? row.wins / (row.wins + row.losses) : 0
  }
  const compare = (a: Participant, b: Participant) =>
    score(b) - score(a) ||
    (score(a) === STANDING_PRIORITY.GROUP_ONLY
      ? percentage(b.user) - percentage(a.user)
      : 0)
  const ordered = state.participants.toSorted(
    (a, b) => compare(a, b) || a.user.localeCompare(b.user)
  )
  const rows: { user: string; rank: number }[] = []
  const needs: string[][] = []
  const contenders = new Set(
    state.groups.flatMap(g =>
      groupStandings(state, g.id)
        .filter(
          row => !row.resolved && row.rank <= state.config.advancementCount
        )
        .map(row => row.user)
    )
  )
  const bracketUsers = new Set(
    bracket
      .flatMap(f => [f.match.user1, f.match.user2])
      .filter(user => user !== null)
  )
  for (let start = 0; start < ordered.length; ) {
    const tied = ordered.filter(player => compare(ordered[start], player) === 0)
    const roundMatches = state.fixtures
      .filter(f => {
        if (score(ordered[start]) === STANDING_PRIORITY.GROUP_ONLY)
          return f.bracket === 'group'
        return (
          (f.bracket === 'lower' ||
            (state.config.eliminationType === 'single' &&
              f.bracket === 'upper')) &&
          STANDING_PRIORITY.ELIMINATED + f.round === score(ordered[start])
        )
      })
      .map(f => f.match)
    rows.push(
      ...rankTiedPlayers(
        tied.map(p => p.user),
        roundMatches,
        users => {
          const groupOnly =
            score(ordered[start]) === STANDING_PRIORITY.GROUP_ONLY
          const settled = groupOnly
            ? groupComplete(state) &&
              users.every(
                user => !contenders.has(user) && !bracketUsers.has(user)
              )
            : score(ordered[start]) >= STANDING_PRIORITY.ELIMINATED &&
              score(ordered[start]) < STANDING_PRIORITY.RUNNER_UP &&
              stageComplete(
                state.fixtures.filter(
                  f =>
                    (f.bracket === 'lower' ||
                      (state.config.eliminationType === 'single' &&
                        f.bracket === 'upper')) &&
                    STANDING_PRIORITY.ELIMINATED + f.round ===
                      score(ordered[start])
                )
              )
          if (settled) needs.push(users)
          return applyLaps && settled
            ? rankLapTie(state, users, false)
            : users.map(user => ({ user, rank: 1, resolved: false }))
        }
      ).map(row => ({ user: row.user, rank: start + row.rank }))
    )
    start += tied.length
  }
  return {
    completed:
      completed &&
      state.fixtures
        .filter(f => !isInactiveFinalReset(f.match))
        .every(f => decided(f.match)),
    rows,
    needs,
  }
}

export function tieBreakerNeeds(state: TournamentState): Map<string, boolean> {
  const needs = new Map<string, boolean>()
  if (!state.config.tieBreakerTrack) return needs
  if (groupComplete(state)) {
    for (const group of state.groups) {
      for (const row of groupStandings(state, group.id, false)) {
        if (!row.resolved)
          needs.set(row.user, row.rank <= state.config.advancementCount)
      }
    }
  }
  for (const users of overallStandings(state, false).needs) {
    for (const user of users) if (!needs.has(user)) needs.set(user, false)
  }
  return needs
}

function editableSlots(fixture: TournamentFixture): ('user1' | 'user2')[] {
  const keys: ('user1' | 'user2')[] = ['user1', 'user2']
  return keys.filter(key => {
    const slot = key === 'user1' ? fixture.slot1 : fixture.slot2
    return (
      fixture.bracket !== 'group' ||
      (fixture.match.status === 'planned' &&
        (!fixture.match[key] || !!slot.override))
    )
  })
}

export function editTournamentMatch(
  state: TournamentState,
  request: EditMatchRequest
): TournamentState {
  if (state.cancelled) throw new Error(loc.no.tournament.session)
  if (state.notReadyReason) throw new Error(loc.no.tournament.roster)
  const before = state
  state = structuredClone(state)
  const fixture = state.fixtures.find(f => f.match.id === request.id)
  if (!fixture) throw new Error(loc.no.tournament.invalid)
  if (
    request.deletedAt ||
    (request.session !== undefined &&
      request.session !== fixture.match.session) ||
    (request.stage !== undefined && request.stage !== fixture.match.stage)
  )
    throw new Error(loc.no.tournament.owned)
  if (isInactiveFinalReset(fixture.match))
    throw new Error(loc.no.tournament.result)
  const setPlayer = (key: 'user1' | 'user2', slotKey: 'slot1' | 'slot2') => {
    const user = request[key]
    if (user === undefined || user === fixture.match[key]) return
    const slot = fixture[slotKey]
    if (!editableSlots(fixture).includes(key))
      throw new Error(loc.no.tournament.owned)
    if (
      user !== null &&
      !state.participants.some(
        p =>
          p.user === user &&
          (fixture.bracket !== 'group' ||
            slot.kind !== 'group_rank' ||
            p.groupId === slot.groupId)
      )
    )
      throw new Error(loc.no.tournament.invalidParticipant)
    slot.override = user ?? undefined
  }
  setPlayer('user1', 'slot1')
  setPlayer('user2', 'slot2')
  const resolvedPlayers = resolveTournament(state)
  const match = resolvedPlayers.fixtures.find(f => f.id === fixture.id)?.match
  if (!match) throw new Error(loc.no.tournament.invalid)
  if (match.user1 && match.user1 === match.user2)
    throw new Error(loc.no.match.error.same_user)
  const status = request.status ?? match.status
  const winner = request.winner === undefined ? match.winner : request.winner
  if (
    !['planned', 'completed', 'cancelled'].includes(status) ||
    (status !== 'planned' && (!match.user1 || !match.user2)) ||
    (winner !== null && winner !== match.user1 && winner !== match.user2) ||
    (status === 'planned' && winner) ||
    (status === 'completed' && !winner)
  )
    throw new Error(loc.no.tournament.result)
  Object.assign(match, { status, winner, updatedAt: new Date() })
  if (request.track !== undefined) {
    if (!request.track) throw new Error(loc.no.tournament.tracks)
    match.track = request.track
  }
  if (request.comment !== undefined) match.comment = request.comment
  if (request.duration !== undefined) match.duration = request.duration
  const resolved = resolveTournament(resolvedPlayers)
  protectResults(before, resolved, fixture.id)
  return resolved
}

function groupCode(index: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let code = ''
  for (
    let value = index + 1;
    value > 0;
    value = Math.floor((value - 1) / alphabet.length)
  )
    code = alphabet[(value - 1) % alphabet.length] + code
  return code || '?'
}

function fixtureLabel(
  state: TournamentState,
  fixture: TournamentFixture
): string {
  const siblings = state.fixtures.filter(
    f => f.bracket === fixture.bracket && f.match.stage === fixture.match.stage
  )
  return `${loc.no.match.stageCode(fixture.match.stage)}${String(siblings.indexOf(fixture) + 1).padStart(2, '0')}`
}

export function tournamentDetails(state: TournamentState): TournamentDetails {
  const label = (slot: Slot): string => {
    if (slot.kind === 'player') return ''
    if (slot.kind === 'group_rank') {
      return loc.no.tournament.groupSlot(
        slot.rank,
        groupCode(state.groups.find(g => g.id === slot.groupId)?.position ?? -1)
      )
    }
    const feeder = state.fixtures.find(f => f.id === slot.matchId)
    return `${slot.kind === 'match_winner' ? loc.no.tournament.winnerCode : loc.no.tournament.loserCode} ${feeder ? fixtureLabel(state, feeder) : '?'}`
  }
  const active = state.fixtures.filter(f => !isInactiveFinalReset(f.match))
  const group = state.fixtures.filter(f => f.bracket === 'group')
  const overall = overallStandings(state)
  const groupSizes = state.groups.map(
    g => state.participants.filter(p => p.groupId === g.id).length
  )
  const guaranteedBracketMatches =
    state.config.eliminationType === 'double' ? 2 : 1
  const bracketRounds = Math.log2(
    state.config.groupsCount * state.config.advancementCount
  )
  const needs = tieBreakerNeeds(state)
  return {
    id: state.id,
    config: state.config,
    frozen: !!state.frozenAt,
    cancelled: state.cancelled,
    notReadyReason: state.notReadyReason,
    participants: state.participants.toSorted(seedingOrder),
    groups: state.groups.map(g => ({
      ...g,
      code: groupCode(g.position),
      standings: groupStandings(state, g.id),
    })),
    tieBreakers: state.tieBreakers
      .filter(lap => !lap.deletedAt)
      .map(lap => ({
        ...lap,
        required: needs.get(lap.user) ?? false,
      })),
    matches: state.fixtures.map(f => ({
      ...f.match,
      tournament: {
        id: state.id,
        label: fixtureLabel(state, f),
        slot1: label(f.slot1),
        slot2: label(f.slot2),
        editableSlots: editableSlots(f),
        readOnly:
          state.id === 'preview' ||
          state.cancelled ||
          !!state.notReadyReason ||
          isInactiveFinalReset(f.match),
        awarded: f.match.status === 'cancelled' && decided(f.match),
      },
    })),
    standings: overall.rows,
    completed: overall.completed,
    progress: {
      decided: active.filter(f => decided(f.match)).length,
      total: active.length,
      groupDecided: group.filter(f => decided(f.match)).length,
      groupTotal: group.length,
    },
    workloadSummary: {
      tracks: new Set([
        ...state.fixtures.flatMap(f => (f.match.track ? [f.match.track] : [])),
      ]).size,
      minMatches:
        Math.min(...groupSizes) -
        1 +
        (state.participants.length ===
        state.config.groupsCount * state.config.advancementCount
          ? guaranteedBracketMatches
          : 0),
      maxMatches:
        Math.max(...groupSizes) -
        1 +
        (state.config.eliminationType === 'double'
          ? bracketRounds * 2 + 1
          : bracketRounds),
    },
  }
}
