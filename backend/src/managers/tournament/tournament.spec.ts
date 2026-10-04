import type { Participant, TournamentState } from '@common/models/tournament'
import { describe, expect, test } from 'bun:test'
import assert from 'node:assert/strict'
import { tournamentDetails } from './tournament'
import { generateTournament } from './tournament.generator'

function createState(count = 6, groupsCount = 1): TournamentState {
  const participants: Participant[] = Array.from(
    { length: count },
    (_, index) => ({
      user: `player-${index}`,
      rating: 1500 - index,
      admission: index,
      groupId: '',
    })
  )
  return generateTournament(
    {
      session: 'test-session',
      groupsCount,
      advancementCount: 2,
      eliminationType: 'single',
      stageTracks: {},
    },
    participants
  )
}

function setResult(state: TournamentState, winner: string, loser: string) {
  const fixture = state.fixtures.find(
    fixture =>
      fixture.bracket === 'group' &&
      [fixture.match.user1, fixture.match.user2].includes(winner) &&
      [fixture.match.user1, fixture.match.user2].includes(loser)
  )
  assert(fixture)
  fixture.match.winner = winner
  fixture.match.status = 'completed'
  return fixture.match
}

describe('Tournament group details', () => {
  test('3–0 and 2–0 share first place without a direct result', () => {
    const state = createState()
    setResult(state, 'player-0', 'player-2')
    setResult(state, 'player-0', 'player-3')
    setResult(state, 'player-0', 'player-4')
    setResult(state, 'player-1', 'player-2')
    setResult(state, 'player-1', 'player-3')
    const group = tournamentDetails(state).groups[0]
    expect(group.progress).toEqual({ decided: 5, total: 15 })
    expect(group.standings.slice(0, 2)).toMatchObject([
      {
        user: 'player-0',
        rank: 1,
        wins: 3,
        losses: 0,
        matchesPlayed: 3,
        winPercentage: 100,
      },
      {
        user: 'player-1',
        rank: 1,
        wins: 2,
        losses: 0,
        matchesPlayed: 2,
        winPercentage: 100,
      },
    ])
    for (const row of group.standings.slice(0, 2)) {
      expect(row.explanation).toEqual({
        kind: 'shared_rank',
        users: ['player-0', 'player-1'],
        reason: 'missing_results',
      })
      expect(row.resolved).toBe(false)
      expect(row.qualifies).toBe(false)
    }
  })

  test('equal percentages are ordered by the deciding match, including its loser', () => {
    const state = createState(4)
    const direct = setResult(state, 'player-0', 'player-1')
    setResult(state, 'player-2', 'player-0')
    setResult(state, 'player-1', 'player-3')
    const group = tournamentDetails(state).groups[0]
    expect(group.standings.slice(1, 3)).toMatchObject([
      {
        user: 'player-0',
        rank: 2,
        wins: 1,
        losses: 1,
        matchesPlayed: 2,
        winPercentage: 50,
      },
      {
        user: 'player-1',
        rank: 3,
        wins: 1,
        losses: 1,
        matchesPlayed: 2,
        winPercentage: 50,
      },
    ])
    for (const row of group.standings.slice(1, 3)) {
      expect(row.explanation).toEqual({
        kind: 'head_to_head',
        matches: [
          { matchId: direct.id, winner: 'player-0', loser: 'player-1' },
        ],
      })
    }
  })

  test('a complete circular tie remains unresolved', () => {
    const state = createState(4)
    setResult(state, 'player-0', 'player-1')
    setResult(state, 'player-1', 'player-2')
    setResult(state, 'player-2', 'player-0')
    const rows = tournamentDetails(state).groups[0].standings.slice(0, 3)
    for (const row of rows) {
      expect(row).toMatchObject({ rank: 1, resolved: false, winPercentage: 50 })
      expect(row.explanation).toEqual({
        kind: 'shared_rank',
        users: ['player-0', 'player-1', 'player-2'],
        reason: 'unresolved_results',
      })
    }
  })

  test('three tied players retain evidence from each ranking step', () => {
    const state = createState()
    const first = setResult(state, 'player-0', 'player-1')
    const second = setResult(state, 'player-0', 'player-2')
    const third = setResult(state, 'player-1', 'player-2')
    setResult(state, 'player-3', 'player-0')
    setResult(state, 'player-4', 'player-0')
    setResult(state, 'player-1', 'player-3')
    setResult(state, 'player-4', 'player-1')
    setResult(state, 'player-2', 'player-3')
    setResult(state, 'player-2', 'player-4')
    const rows = tournamentDetails(state).groups[0].standings.filter(
      row => row.winPercentage === 50
    )
    expect(rows.map(row => row.user)).toEqual([
      'player-0',
      'player-1',
      'player-2',
    ])
    expect(rows[0].explanation).toEqual({
      kind: 'head_to_head',
      matches: [
        { matchId: first.id, winner: 'player-0', loser: 'player-1' },
        { matchId: second.id, winner: 'player-0', loser: 'player-2' },
      ],
    })
    expect(rows[1].explanation).toEqual({
      kind: 'head_to_head',
      matches: [
        { matchId: first.id, winner: 'player-0', loser: 'player-1' },
        { matchId: third.id, winner: 'player-1', loser: 'player-2' },
      ],
    })
    expect(rows[2].explanation).toEqual({
      kind: 'head_to_head',
      matches: [
        { matchId: second.id, winner: 'player-0', loser: 'player-2' },
        { matchId: third.id, winner: 'player-1', loser: 'player-2' },
      ],
    })
  })

  test('unplayed and cancelled matches do not count, awarded wins do', () => {
    const state = createState(4)
    const cancelled = state.fixtures.find(
      fixture => fixture.bracket === 'group'
    )
    assert(cancelled)
    cancelled.match.status = 'cancelled'
    expect(tournamentDetails(state).groups[0].progress.decided).toBe(0)
    for (const row of tournamentDetails(state).groups[0].standings)
      expect(row).toMatchObject({ matchesPlayed: 0, winPercentage: 0 })
    assert(cancelled.match.user1)
    cancelled.match.winner = cancelled.match.user1
    const details = tournamentDetails(state)
    expect(details.groups[0].progress.decided).toBe(1)
    expect(details.groups[0].standings[0]).toMatchObject({
      user: cancelled.match.user1,
      wins: 1,
      matchesPlayed: 1,
      winPercentage: 100,
    })
    expect(
      details.matches.find(match => match.id === cancelled.match.id)?.tournament
        ?.awarded
    ).toBe(true)
  })

  test('a resolved player can precede an unresolved circular subset', () => {
    const state = createState(8)
    for (const other of ['player-1', 'player-2', 'player-3'])
      setResult(state, 'player-0', other)
    for (const other of ['player-4', 'player-5', 'player-6']) {
      setResult(state, other, 'player-0')
      setResult(state, other, 'player-7')
    }
    setResult(state, 'player-1', 'player-2')
    setResult(state, 'player-2', 'player-3')
    setResult(state, 'player-3', 'player-1')
    setResult(state, 'player-1', 'player-4')
    setResult(state, 'player-2', 'player-5')
    setResult(state, 'player-3', 'player-6')
    const rows = tournamentDetails(state).groups[0].standings.filter(
      row => row.winPercentage === 50
    )
    expect(rows[0]).toMatchObject({
      user: 'player-0',
      rank: 4,
      resolved: true,
      explanation: { kind: 'head_to_head' },
    })
    for (const row of rows.slice(1))
      expect(row).toMatchObject({
        rank: 5,
        resolved: false,
        explanation: {
          kind: 'shared_rank',
          users: ['player-1', 'player-2', 'player-3'],
          reason: 'unresolved_results',
        },
      })
  })

  test('repeated pairings identify the latest decided direct result', () => {
    const state = createState(4)
    const first = setResult(state, 'player-0', 'player-1')
    const fixture = state.fixtures.find(
      fixture => fixture.match.id === first.id
    )
    assert(fixture)
    const replay = structuredClone(fixture)
    replay.id = 'replay'
    replay.match.id = 'replay'
    replay.match.winner = 'player-1'
    replay.order = state.fixtures.length
    state.fixtures.push(replay)
    const rows = tournamentDetails(state).groups[0].standings.slice(0, 2)
    expect(rows.map(row => row.user)).toEqual(['player-1', 'player-0'])
    for (const row of rows)
      expect(row.explanation).toEqual({
        kind: 'head_to_head',
        matches: [{ matchId: 'replay', winner: 'player-1', loser: 'player-0' }],
      })
  })

  test('group identity selects only its fixtures, including planned matches', () => {
    const state = createState(8, 2)
    const details = tournamentDetails(state)
    for (const group of details.groups) {
      const selected = details.matches.filter(
        match => match.tournament?.groupId === group.id
      )
      expect(selected.length).toBe(group.progress.total)
      expect(selected.length).toBe(6)
      expect(selected.map(match => match.id)).toEqual(
        state.fixtures
          .filter(fixture => fixture.groupId === group.id)
          .map(fixture => fixture.match.id)
      )
      expect(selected.every(match => match.status === 'planned')).toBe(true)
    }
    expect(
      details.matches
        .filter(match => match.stage !== 'group')
        .every(match => match.tournament?.groupId === null)
    ).toBe(true)
  })
})
