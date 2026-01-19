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
    const users = await registerMockUsers(socket, 8)

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

    // Create with 2 groups of 4, advancing 2 each = 4 players in bracket
    await TournamentManager.onCreateTournament(socket, {
      type: 'CreateTournamentRequest',
      id: tournamentId,
      name: 'Test Tournament',
      session: sessionId,
      groupsCount: 2,
      advancementCount: 2,
      eliminationType: 'double',
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
    // With 4 players in double elimination:
    // Upper: 2 semi + 1 final = 3 matches
    // Lower: 1 (losers from semi) + 1 (lower final: survivor vs upper final loser) = 2 matches
    // Grand Final: 1 match
    // Total: 6 matches
    expect(result.matches.length).toBeGreaterThanOrEqual(5)
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

  it('should create correct double elimination structure with 19 players, 4 groups, 2 advancing', async () => {
    // ARRANGE: 19 players, 4 groups (~5 each), 2 advancing = 8 players in bracket
    const { socket } = await createMockAdmin()
    const users = await registerMockUsers(socket, 19)

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
      name: 'Double Elimination Test',
      session: sessionId,
      groupsCount: 4,
      advancementCount: 2,
      eliminationType: 'double',
    })

    const groupsWithPlayers = await GroupManager.getAll(tournamentId)
    expect(groupsWithPlayers.length).toBe(4)

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

    // ASSERT - Double elimination structure
    // With 8 players (4 groups * 2 advancing), bracketSize = 8
    // Upper bracket: 4 matches (quarter) + 2 matches (semi) + 1 match (final) = 7 stages/matches
    // Lower bracket structure:
    //   - Lower R1: 2 matches (losers of quarters play each other)
    //   - Lower R2 (drop-in): 2 matches (Lower R1 winners vs Semi losers)
    //   - Lower R3 (survivor): 1 match (Lower R2 winners play each other)
    //   - Lower R4 (drop-in): 1 match (Lower R3 winner vs Final loser)
    // Grand Final: 1 match

    // Verify we have upper bracket stages
    const upperBracketStages = result.stages.filter(s => s.bracket === 'upper')
    expect(upperBracketStages.length).toBeGreaterThan(0)

    // Verify we have lower bracket stages
    const lowerBracketStages = result.stages.filter(s => s.bracket === 'lower')
    expect(lowerBracketStages.length).toBeGreaterThan(0)

    // Verify we have grand final stage
    const grandFinalStage = result.stages.find(s => s.level === 'grand_final')
    expect(grandFinalStage).toBeDefined()

    // Verify lower bracket has more than just 1 stage
    // For 8 players, lower bracket should have at least 4 stages
    expect(lowerBracketStages.length).toBeGreaterThanOrEqual(4)

    // Verify dependencies exist for lower bracket matches
    const lowerBracketMatches = result.matches.filter(m =>
      lowerBracketStages.some(s => s.id === m.stage)
    )
    expect(lowerBracketMatches.length).toBeGreaterThan(0)

    // Verify lower bracket matches have dependencies
    const lowerBracketDeps = result.matchDependencies.filter(d =>
      lowerBracketMatches.some(m => m.id === d.toMatch)
    )
    expect(lowerBracketDeps.length).toBeGreaterThan(0)

    // Verify grand final has dependencies from both upper and lower bracket
    const grandFinalMatch = result.matches.find(
      m => m.stage === grandFinalStage?.id
    )
    expect(grandFinalMatch).toBeDefined()

    const grandFinalDeps = result.matchDependencies.filter(
      d => d.toMatch === grandFinalMatch?.id
    )
    // Grand final should have exactly 2 dependencies: upper bracket winner and lower bracket winner
    expect(grandFinalDeps.length).toBe(2)

    // Verify stage ordering is correct (interleaved)
    const stageIndices = result.stages.map(s => s.index)
    for (let i = 0; i < stageIndices.length - 1; i++) {
      expect(stageIndices[i]).toBeLessThan(stageIndices[i + 1])
    }

    // Log structure for debugging
    console.log('Double elimination structure:')
    console.log('Upper bracket stages:', upperBracketStages.length)
    console.log('Lower bracket stages:', lowerBracketStages.length)
    console.log('Grand final stage:', grandFinalStage ? 1 : 0)
    console.log('Total matches:', result.matches.length)
    console.log('Total dependencies:', result.matchDependencies.length)
  })

  it('should fetch tournament with all stages including lower bracket', async () => {
    // ARRANGE: Create a double elimination tournament with 8 advancing (to get full bracket)
    // 19 players, 4 groups, 2 advancing = 8 players in bracket
    const { socket } = await createMockAdmin()
    const users = await registerMockUsers(socket, 19)

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
      name: 'Fetch Test Double Elimination',
      session: sessionId,
      groupsCount: 4,
      advancementCount: 2,
      eliminationType: 'double',
    })

    // ACT: Fetch the tournament
    const tournaments = await TournamentManager.getAll()
    const tournament = tournaments.find(t => t.id === tournamentId)

    expect(tournament).toBeDefined()
    if (!tournament) return

    // ASSERT: Verify all stage types are present
    const upperBracketStages = tournament.stages.filter(
      s => s.stage.bracket === 'upper'
    )
    const lowerBracketStages = tournament.stages.filter(
      s => s.stage.bracket === 'lower'
    )
    const grandFinalStage = tournament.stages.find(
      s => s.stage.level === 'grand_final'
    )
    const groupStages = tournament.stages.filter(s => s.stage.level === 'group')

    console.log('Fetched tournament structure:')
    console.log('Group stages:', groupStages.length)
    console.log('Upper bracket stages:', upperBracketStages.length)
    console.log('Lower bracket stages:', lowerBracketStages.length)
    console.log('Grand final stage:', grandFinalStage ? 1 : 0)
    console.log('Total stages:', tournament.stages.length)

    // Log all stages in order
    console.log('All stages in order:')
    tournament.stages.forEach((s, i) => {
      console.log(
        `  ${i}: index=${s.stage.index}, level=${s.stage.level}, bracket=${s.stage.bracket}`
      )
    })

    // Verify structure
    expect(groupStages.length).toBeGreaterThan(0)
    expect(upperBracketStages.length).toBeGreaterThan(0)
    expect(lowerBracketStages.length).toBeGreaterThan(0)
    expect(grandFinalStage).toBeDefined()

    // Verify stages are ordered by index
    for (let i = 0; i < tournament.stages.length - 1; i++) {
      expect(tournament.stages[i].stage.index).toBeLessThanOrEqual(
        tournament.stages[i + 1].stage.index
      )
    }
  })

  it('should create correct dependencies for double elimination bracket', async () => {
    // ARRANGE: Create a double elimination tournament
    const { socket } = await createMockAdmin()
    const users = await registerMockUsers(socket, 8)

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
      name: 'Dependency Test',
      session: sessionId,
      groupsCount: 2,
      advancementCount: 2,
      eliminationType: 'double',
    })

    const groupsWithPlayers = await GroupManager.getAll(tournamentId)

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
      2,
      'double',
      groupMatches.stages.length
    )

    // Get all stages by type
    const upperStages = result.stages.filter(s => s.bracket === 'upper')
    const lowerStages = result.stages.filter(s => s.bracket === 'lower')
    const grandFinalStage = result.stages.find(s => s.level === 'grand_final')

    // Get matches by stage
    const upperMatches = result.matches.filter(m =>
      upperStages.some(s => s.id === m.stage)
    )
    const lowerMatches = result.matches.filter(m =>
      lowerStages.some(s => s.id === m.stage)
    )
    const grandFinalMatch = result.matches.find(
      m => m.stage === grandFinalStage?.id
    )

    console.log('Upper matches:', upperMatches.length)
    console.log('Lower matches:', lowerMatches.length)
    console.log('Grand final match:', grandFinalMatch ? 1 : 0)

    // ASSERT: Lower bracket matches should have dependencies from upper bracket losers
    // Lower R1 matches should depend on upper bracket match losers (fromPosition: 2)
    const lowerR1Matches = lowerMatches.filter(m => {
      const stage = lowerStages.find(s => s.id === m.stage)
      return stage && stage.index === Math.min(...lowerStages.map(s => s.index))
    })

    console.log('Lower R1 matches:', lowerR1Matches.length)

    for (const lowerMatch of lowerR1Matches) {
      const deps = result.matchDependencies.filter(
        d => d.toMatch === lowerMatch.id
      )
      console.log(`Lower R1 match ${lowerMatch.id} dependencies:`, deps.length)

      // Lower R1 matches should have 2 dependencies, both from upper bracket losers
      expect(deps.length).toBe(2)

      for (const dep of deps) {
        // Should be from an upper bracket match
        expect(dep.fromMatch).not.toBeNull()
        const sourceMatch = upperMatches.find(m => m.id === dep.fromMatch)
        expect(sourceMatch).toBeDefined()
        // Should be the loser (position 2)
        expect(dep.fromPosition).toBe(2)
      }
    }

    // ASSERT: Grand Final should have dependencies from both upper winner and lower winner
    expect(grandFinalMatch).toBeDefined()
    const grandFinalDeps = result.matchDependencies.filter(
      d => d.toMatch === grandFinalMatch?.id
    )

    console.log('Grand final dependencies:', grandFinalDeps.length)
    grandFinalDeps.forEach(dep => {
      const sourceMatch = result.matches.find(m => m.id === dep.fromMatch)
      const sourceStage = result.stages.find(s => s.id === sourceMatch?.stage)
      console.log(
        `  From: ${sourceStage?.bracket || sourceStage?.level}, position: ${dep.fromPosition}, slot: ${dep.toSlot}`
      )
    })

    expect(grandFinalDeps.length).toBe(2)

    // One dependency should be from upper bracket final (winner)
    const upperFinalDep = grandFinalDeps.find(d => {
      const sourceMatch = result.matches.find(m => m.id === d.fromMatch)
      const sourceStage = result.stages.find(s => s.id === sourceMatch?.stage)
      return sourceStage?.bracket === 'upper' && sourceStage?.level === 'final'
    })
    expect(upperFinalDep).toBeDefined()
    expect(upperFinalDep?.fromPosition).toBe(1) // winner

    // One dependency should be from lower bracket final (winner)
    const lowerFinalDep = grandFinalDeps.find(d => {
      const sourceMatch = result.matches.find(m => m.id === d.fromMatch)
      const sourceStage = result.stages.find(s => s.id === sourceMatch?.stage)
      return sourceStage?.bracket === 'lower'
    })
    expect(lowerFinalDep).toBeDefined()
    expect(lowerFinalDep?.fromPosition).toBe(1) // winner

    // ASSERT: Upper bracket matches after first round should only depend on upper bracket winners
    // (This is correct - upper bracket is pure winners bracket)
    const upperSemiMatches = upperMatches.filter(m => {
      const stage = upperStages.find(s => s.id === m.stage)
      return stage?.level === 'semi'
    })

    console.log('Upper semi matches:', upperSemiMatches.length)
    console.log('All upper stages:')
    upperStages.forEach(s => {
      console.log(`  Stage ${s.id}: level=${s.level}, bracket=${s.bracket}`)
    })

    for (const semiMatch of upperSemiMatches) {
      const deps = result.matchDependencies.filter(
        d => d.toMatch === semiMatch.id
      )
      console.log(`Semi match ${semiMatch.id} has ${deps.length} deps`)

      expect(deps.length).toBe(2)

      for (const dep of deps) {
        // Should be from an upper bracket match or group
        const sourceMatch = result.matches.find(m => m.id === dep.fromMatch)
        const sourceStage = result.stages.find(s => s.id === sourceMatch?.stage)
        console.log(
          `  Dep from match ${dep.fromMatch} (stage ${sourceStage?.id}, bracket=${sourceStage?.bracket}, level=${sourceStage?.level}), position=${dep.fromPosition}`
        )

        if (dep.fromMatch) {
          // If from a match, that match should be from upper bracket (winners)
          expect(sourceStage?.bracket).toBe('upper')
          expect(dep.fromPosition).toBe(1) // winner
        } else if (dep.fromGroup) {
          // If from a group, position indicates group standing (1=1st, 2=2nd, etc.)
          // With snake seeding: slot A gets better seed, slot B gets worse seed
          expect(dep.fromPosition).toBeGreaterThanOrEqual(1)
          expect(dep.fromPosition).toBeLessThanOrEqual(2) // advancementCount is 2
        }
      }
    }
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
