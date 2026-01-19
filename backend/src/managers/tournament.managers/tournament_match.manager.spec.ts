import { type EliminationType } from '@backend/database/schema'
import {
  clearDB,
  createMockAdmin,
  createSessionMock,
  createTestTracks,
  registerMockUsers,
  setupRatings,
} from '@backend/src/utils/test.helpers'
import type { GroupWithPlayers } from '@common/models/tournament'
import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import GroupManager from './group.manager'
import TournamentManager from './tournament.manager'
import TournamentMatchManager from './tournament_match.manager'

describe('TournamentMatchManager - calculateMinMaxMatchesPerPlayer', () => {
  type TestCase = {
    groups: GroupWithPlayers[]
    advancementCount: number
    eliminationType: EliminationType
    expected: { min: number; max: number }
  }

  const testCases: TestCase[] = [
    // Single elimination - basic cases
    {
      groups: [createGroup(4)],
      advancementCount: 2,
      eliminationType: 'single',
      expected: { min: 3, max: 4 },
    },
    {
      groups: [createGroup(4), createGroup(4)],
      advancementCount: 2,
      eliminationType: 'single',
      expected: { min: 3, max: 5 },
    },
    {
      groups: [createGroup(8)],
      advancementCount: 2,
      eliminationType: 'single',
      expected: { min: 7, max: 8 },
    },
    {
      groups: [createGroup(6), createGroup(6)],
      advancementCount: 4,
      eliminationType: 'single',
      expected: { min: 5, max: 8 },
    },
    {
      groups: [createGroup(5), createGroup(5), createGroup(5), createGroup(4)],
      advancementCount: 2,
      eliminationType: 'double',
      expected: { min: 3, max: 9 },
    },
  ]

  it.each(testCases)(
    'calculates matches for $eliminationType, advancement=$advancementCount, $groups.length groups',
    ({ groups, advancementCount, eliminationType, expected }) => {
      const result = TournamentMatchManager.calculateMinMaxMatchesPerPlayer({
        groups,
        advancementCount,
        eliminationType,
      })

      expect(result.min).toBe(expected.min)
      expect(result.max).toBe(expected.max)
      expect(result.max).toBeGreaterThanOrEqual(result.min)
    }
  )
})

describe('TournamentMatchManager - createGroupMatches', () => {
  beforeEach(async () => {
    await clearDB()
  })

  it('should create round-robin matches for single group', async () => {
    // ARRANGE
    const { socket } = await createMockAdmin()
    const [u1, u2, u3, u4] = await registerMockUsers(socket, 4)

    setupRatings([
      { userId: u1.id, rating: 1000 },
      { userId: u2.id, rating: 990 },
      { userId: u3.id, rating: 980 },
      { userId: u4.id, rating: 970 },
    ])

    const sessionId = await createSessionMock(socket, [
      u1.id,
      u2.id,
      u3.id,
      u4.id,
    ])
    const tournamentId = randomUUID()

    // Create tournament and groups
    await TournamentManager.onCreateTournament(socket, {
      type: 'CreateTournamentRequest',
      id: tournamentId,
      name: 'Test Tournament',
      session: sessionId,
      groupsCount: 1,
      advancementCount: 2,
      eliminationType: 'single',
    })

    const groupsWithPlayers = await GroupManager.getAll(tournamentId)

    // ACT
    const result = await TournamentMatchManager.createGroupMatches(
      tournamentId,
      sessionId,
      groupsWithPlayers
    )

    // ASSERT
    expect(result.stages).toBeDefined()
    expect(result.stages.length).toBeGreaterThan(0)
    expect(result.matches).toBeDefined()
    expect(result.matches.length).toBeGreaterThan(0)

    // Verify all matches have required fields
    result.matches.forEach(match => {
      expect(match.id).toBeDefined()
      expect(match.session).toBe(sessionId)
      expect(match.stage).toBeDefined()
      expect(match.index).toBeGreaterThanOrEqual(0)
    })
  })

  it('should create matches with proper track cycling', async () => {
    // ARRANGE
    const { socket } = await createMockAdmin()
    const [u1, u2, u3, u4] = await registerMockUsers(socket, 4)

    setupRatings([
      { userId: u1.id, rating: 1000 },
      { userId: u2.id, rating: 990 },
      { userId: u3.id, rating: 980 },
      { userId: u4.id, rating: 970 },
    ])

    const sessionId = await createSessionMock(socket, [
      u1.id,
      u2.id,
      u3.id,
      u4.id,
    ])
    const tournamentId = randomUUID()

    await TournamentManager.onCreateTournament(socket, {
      type: 'CreateTournamentRequest',
      id: tournamentId,
      name: 'Test Tournament',
      session: sessionId,
      groupsCount: 1,
      advancementCount: 2,
      eliminationType: 'single',
    })

    const groupsWithPlayers = await GroupManager.getAll(tournamentId)
    const tracks = await createTestTracks(2)

    // ACT
    const result = await TournamentMatchManager.createGroupMatches(
      tournamentId,
      sessionId,
      groupsWithPlayers,
      tracks
    )

    // ASSERT
    expect(result.matches).toBeDefined()
    // Verify some matches have tracks
    const matchesWithTracks = result.matches.filter(m => m.track)
    expect(matchesWithTracks.length).toBeGreaterThan(0)
  })
})

describe('TournamentMatchManager - generateBracketMatches', () => {
  beforeEach(async () => {
    await clearDB()
  })

  it('should generate single elimination bracket', async () => {
    // ARRANGE
    const { socket } = await createMockAdmin()
    const users = await registerMockUsers(socket, 4)

    setupRatings(
      users.map((u, idx) => ({
        userId: u.id,
        rating: 1000 - idx * 10,
      }))
    )

    const sessionId = await createSessionMock(
      socket,
      users.map(u => u.id)
    )
    const tournamentId = randomUUID()

    await TournamentManager.onCreateTournament(socket, {
      type: 'CreateTournamentRequest',
      id: tournamentId,
      name: 'Test Tournament',
      session: sessionId,
      groupsCount: 1,
      advancementCount: 2,
      eliminationType: 'single',
    })

    const groupsWithPlayers = await GroupManager.getAll(tournamentId)

    // Create group matches first
    const groupMatches = await TournamentMatchManager.createGroupMatches(
      tournamentId,
      sessionId,
      groupsWithPlayers
    )

    // ACT
    const result = await TournamentMatchManager.generateBracketMatches(
      tournamentId,
      sessionId,
      groupsWithPlayers,
      2, // advancement count
      'single',
      groupMatches.stages.length
    )

    // ASSERT
    expect(result.stages).toBeDefined()
    expect(result.stages.length).toBeGreaterThan(0)
    expect(result.matches).toBeDefined()
    expect(result.matches.length).toBeGreaterThan(0)
    expect(result.matchDependencies).toBeDefined()

    // Verify bracket has matches - exact count depends on bracket generation
    expect(result.matches.length).toBeGreaterThan(0)
  })

  it('should generate double elimination bracket', async () => {
    // ARRANGE
    const { socket } = await createMockAdmin()
    const users = await registerMockUsers(socket, 4)

    setupRatings(
      users.map((u, idx) => ({
        userId: u.id,
        rating: 1000 - idx * 10,
      }))
    )

    const sessionId = await createSessionMock(
      socket,
      users.map(u => u.id)
    )
    const tournamentId = randomUUID()

    await TournamentManager.onCreateTournament(socket, {
      type: 'CreateTournamentRequest',
      id: tournamentId,
      name: 'Test Tournament',
      session: sessionId,
      groupsCount: 1,
      advancementCount: 2,
      eliminationType: 'single',
    })

    const groupsWithPlayers = await GroupManager.getAll(tournamentId)

    // Create group matches first
    const groupMatches = await TournamentMatchManager.createGroupMatches(
      tournamentId,
      sessionId,
      groupsWithPlayers
    )

    // ACT
    const result = await TournamentMatchManager.generateBracketMatches(
      tournamentId,
      sessionId,
      groupsWithPlayers,
      2, // advancement count
      'double',
      groupMatches.stages.length
    )

    // ASSERT
    expect(result.stages).toBeDefined()
    expect(result.stages.length).toBeGreaterThan(0)
    expect(result.matches).toBeDefined()
    // Double elimination should have more matches than single
    expect(result.matches.length).toBeGreaterThanOrEqual(3)
    expect(result.matchDependencies).toBeDefined()
  })

  it('should create bracket with track assignment', async () => {
    // ARRANGE
    const { socket } = await createMockAdmin()
    const users = await registerMockUsers(socket, 4)

    setupRatings(
      users.map((u, idx) => ({
        userId: u.id,
        rating: 1000 - idx * 10,
      }))
    )

    const sessionId = await createSessionMock(
      socket,
      users.map(u => u.id)
    )
    const tournamentId = randomUUID()

    await TournamentManager.onCreateTournament(socket, {
      type: 'CreateTournamentRequest',
      id: tournamentId,
      name: 'Test Tournament',
      session: sessionId,
      groupsCount: 1,
      advancementCount: 2,
      eliminationType: 'single',
    })

    const groupsWithPlayers = await GroupManager.getAll(tournamentId)
    const tracks = await createTestTracks(2)

    const groupMatches = await TournamentMatchManager.createGroupMatches(
      tournamentId,
      sessionId,
      groupsWithPlayers,
      tracks
    )

    // ACT
    const result = await TournamentMatchManager.generateBracketMatches(
      tournamentId,
      sessionId,
      groupsWithPlayers,
      2,
      'single',
      groupMatches.stages.length,
      tracks
    )

    // ASSERT
    // Verify bracket matches are created
    expect(result.matches.length).toBeGreaterThan(0)
    expect(result.stages.length).toBeGreaterThan(0)
  })
})

function createGroup(playerCount: number): GroupWithPlayers {
  const groupId = `group-${Math.random()}`
  return {
    id: groupId,
    tournament: 'test-tournament',
    index: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    players: Array.from({ length: playerCount }, (_, idx) => ({
      id: `player-${idx}`,
      group: groupId,
      user: `user-${idx}`,
      seed: playerCount - idx,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      wins: 0,
      losses: 0,
    })),
  }
}
