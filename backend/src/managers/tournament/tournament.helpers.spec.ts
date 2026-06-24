import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assignParticipantsToGroupsSnake,
  buildGroupStandings,
  createRoundRobinGroupMatches,
  createSingleEliminationBracket,
  getSlotLabel,
  rankParticipantsByQualification,
} from './tournament.helpers'

function createParticipant(
  id: string,
  qualificationDuration: number | null,
  globalRanking: number | null
) {
  return {
    user: {
      id,
      email: `${id}@example.com`,
      firstName: id,
      lastName: 'Player',
      shortName: id.toUpperCase(),
      role: 'user',
      createdAt: new Date(),
      updatedAt: null,
      deletedAt: null,
      passwordHash: undefined,
    },
    qualificationRank: 0,
    qualificationDuration,
    globalRanking,
  }
}

test('rankParticipantsByQualification prefers laps then rating fallback', () => {
  const ranked = rankParticipantsByQualification([
    createParticipant('charlie', null, 3),
    createParticipant('alpha', 1200, 5),
    createParticipant('bravo', 1100, 2),
    createParticipant('delta', null, 1),
  ])

  assert.deepEqual(
    ranked.map(participant => participant.user.id),
    ['bravo', 'alpha', 'delta', 'charlie']
  )
  assert.deepEqual(
    ranked.map(participant => participant.qualificationRank),
    [1, 2, 3, 4]
  )
})

test('assignParticipantsToGroupsSnake alternates direction each row', () => {
  const groups = assignParticipantsToGroupsSnake(
    rankParticipantsByQualification([
      createParticipant('p1', 1000, 1),
      createParticipant('p2', 1010, 2),
      createParticipant('p3', 1020, 3),
      createParticipant('p4', 1030, 4),
      createParticipant('p5', 1040, 5),
      createParticipant('p6', 1050, 6),
      createParticipant('p7', 1060, 7),
      createParticipant('p8', 1070, 8),
    ]),
    4,
    (() => {
      let count = 0
      return () => `group-${count++}`
    })()
  )

  assert.deepEqual(
    groups.map(group => group.players.map(player => player.user.id)),
    [
      ['p1', 'p8'],
      ['p2', 'p7'],
      ['p3', 'p6'],
      ['p4', 'p5'],
    ]
  )
})

test('createRoundRobinGroupMatches creates all pairings in order', () => {
  const groups = [
    {
      id: 'group-a',
      name: 'A',
      players: rankParticipantsByQualification([
        createParticipant('p1', 1000, 1),
        createParticipant('p2', 1010, 2),
        createParticipant('p3', 1020, 3),
      ]),
    },
  ]

  let count = 0
  const matches = createRoundRobinGroupMatches(groups, 'track-1', () => `id-${count++}`)

  assert.equal(matches.length, 3)
  assert.deepEqual(
    matches.map(match => [match.user1, match.user2]),
    [
      ['p1', 'p2'],
      ['p1', 'p3'],
      ['p2', 'p3'],
    ]
  )
})

test('createSingleEliminationBracket builds deterministic first round dependencies', () => {
  const groups = [
    {
      id: 'group-a',
      name: 'A',
      players: [],
    },
    {
      id: 'group-b',
      name: 'B',
      players: [],
    },
    {
      id: 'group-c',
      name: 'C',
      players: [],
    },
    {
      id: 'group-d',
      name: 'D',
      players: [],
    },
  ]

  let count = 0
  const bracket = createSingleEliminationBracket(groups, 2, 'track-1', () => `id-${count++}`)

  assert.equal(bracket.length, 7)
  assert.deepEqual(
    bracket.slice(0, 4).map(match => [
      match.slotA?.type === 'group_rank'
        ? `${match.slotA.groupName}${match.slotA.rank}`
        : null,
      match.slotB?.type === 'group_rank'
        ? `${match.slotB.groupName}${match.slotB.rank}`
        : null,
    ]),
    [
      ['A1', 'D2'],
      ['B2', 'C1'],
      ['A2', 'D1'],
      ['B1', 'C2'],
    ]
  )
})

test('buildGroupStandings sorts by wins, losses, then qualification rank', () => {
  const players = rankParticipantsByQualification([
    createParticipant('p1', 1000, 1),
    createParticipant('p2', 1010, 2),
    createParticipant('p3', 1020, 3),
  ])

  const standings = buildGroupStandings(
    {
      id: 'group-a',
      name: 'A',
      players,
    },
    [
      {
        user1: 'p1',
        user2: 'p2',
        winner: 'p1',
        status: 'completed',
      },
      {
        user1: 'p1',
        user2: 'p3',
        winner: 'p3',
        status: 'completed',
      },
      {
        user1: 'p2',
        user2: 'p3',
        winner: 'p3',
        status: 'completed',
      },
    ]
  )

  assert.deepEqual(
    standings.map(standing => standing.user.id),
    ['p3', 'p1', 'p2']
  )
})

test('getSlotLabel prefers resolved player and falls back to dependency labels', () => {
  const participants = new Map([
    [
      'p1',
      rankParticipantsByQualification([createParticipant('p1', 1000, 1)])[0],
    ],
  ])

  assert.deepEqual(
    getSlotLabel(
      { type: 'group_rank', groupId: 'group-a', groupName: 'A', rank: 1 },
      participants,
      null
    ),
    {
      userId: null,
      label: 'A1',
    }
  )

  assert.deepEqual(
    getSlotLabel(
      { type: 'match_winner', tournamentMatchId: 'tm-1', matchName: 'Semifinal 1' },
      participants,
      'p1'
    ),
    {
      userId: 'p1',
      label: 'P1',
    }
  )
})
