import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearDB,
  createMockAdmin,
  createSessionMock,
  registerMockUsers,
  setupRatings,
} from '../../utils/test.helpers'
import StageManager from './stage.manager'
import TournamentManager from './tournament.manager'

describe('StageManager.getStageLevel', () => {
  const invalidCounts = [-1, 0, 3, 5, 6, 7, 9, 10, 32, 100]
  const stageLevelTests: [number, string][] = [
    [1, 'final'],
    [2, 'semi'],
    [4, 'quarter'],
    [8, 'eight'],
    [16, 'sixteen'],
  ]

  stageLevelTests.forEach(([matches, expectedLevel]) => {
    it(`correctly maps ${matches} matches to "${expectedLevel}"`, () => {
      expect(StageManager.getStageLevel(matches)).toBe(expectedLevel)
    })
  })

  invalidCounts.forEach(count => {
    it(`throws for invalid match count: ${count}`, () => {
      expect(() => StageManager.getStageLevel(count)).toThrow()
    })
  })
})

describe('StageManager - createStage & getStage', () => {
  beforeEach(async () => {
    await clearDB()
  })

  it('should create a stage and retrieve it', async () => {
    // ARRANGE: Create a tournament first
    const { tournamentId } = await createTestTournament()
    const stageId = randomUUID()

    // ACT: Create a stage
    const createdStage = await StageManager.createStage({
      id: stageId,
      tournament: tournamentId,
      bracket: null,
      level: 'final',
      index: 0,
      createdAt: new Date(),
      updatedAt: null,
      deletedAt: null,
    })

    // ACT: Retrieve the stage
    const retrievedStage = await StageManager.getStage(stageId)

    // ASSERT
    expect(createdStage.id).toBe(stageId)
    expect(createdStage.tournament).toBe(tournamentId)
    expect(createdStage.level).toBe('final')
    expect(createdStage.index).toBe(0)
    expect(retrievedStage.id).toBe(stageId)
    expect(retrievedStage.level).toBe('final')
  })

  it('should create multiple stages with different levels', async () => {
    // ARRANGE: Create a tournament first
    const { tournamentId } = await createTestTournament()
    const levels = ['final', 'semi', 'quarter', 'eight'] as const

    // ACT: Create stages with different levels
    const createdStages = await Promise.all(
      levels.map((level, index) =>
        StageManager.createStage({
          id: randomUUID(),
          tournament: tournamentId,
          bracket: null,
          level,
          index,
          createdAt: new Date(),
          updatedAt: null,
          deletedAt: null,
        })
      )
    )

    // ASSERT
    expect(createdStages).toHaveLength(4)
    expect(createdStages[0].level).toBe('final')
    expect(createdStages[1].level).toBe('semi')
    expect(createdStages[2].level).toBe('quarter')
    expect(createdStages[3].level).toBe('eight')

    // Verify all stages can be retrieved
    for (const stage of createdStages) {
      const retrieved = await StageManager.getStage(stage.id)
      expect(retrieved.id).toBe(stage.id)
      expect(retrieved.level).toBe(stage.level)
    }
  })

  it('should throw error when getting non-existent stage', async () => {
    // ACT & ASSERT
    const fakeStageId = randomUUID()
    await expect(StageManager.getStage(fakeStageId)).rejects.toThrow()
  })

  it('should create stage with null bracket', async () => {
    // ARRANGE: Create a tournament first
    const { tournamentId } = await createTestTournament()
    const stageId = randomUUID()

    // ACT
    const createdStage = await StageManager.createStage({
      id: stageId,
      tournament: tournamentId,
      bracket: null,
      level: 'semi',
      index: 1,
      createdAt: new Date(),
      updatedAt: null,
      deletedAt: null,
    })

    const retrieved = await StageManager.getStage(stageId)

    // ASSERT
    expect(createdStage.bracket).toBeNull()
    expect(retrieved.bracket).toBeNull()
  })

  it('should preserve all stage properties through create and retrieve', async () => {
    // ARRANGE: Create a tournament first
    const { tournamentId } = await createTestTournament()
    const stageId = randomUUID()
    const createdAt = new Date()

    // ACT
    const createdStage = await StageManager.createStage({
      id: stageId,
      tournament: tournamentId,
      bracket: null,
      level: 'quarter',
      index: 5,
      createdAt,
      updatedAt: null,
      deletedAt: null,
    })

    const retrieved = await StageManager.getStage(stageId)

    // ASSERT - All properties match
    expect(retrieved.id).toBe(createdStage.id)
    expect(retrieved.tournament).toBe(createdStage.tournament)
    expect(retrieved.bracket).toBe(createdStage.bracket)
    expect(retrieved.level).toBe(createdStage.level)
    expect(retrieved.index).toBe(createdStage.index)
    expect(retrieved.updatedAt).toBe(createdStage.updatedAt)
    expect(retrieved.deletedAt).toBe(createdStage.deletedAt)
  })

  it('should create stage with all stage levels', async () => {
    // ARRANGE: Create a tournament
    const { tournamentId } = await createTestTournament()

    // ACT: Create stages with all valid levels
    const levels = ['final', 'semi', 'quarter', 'eight', 'sixteen'] as const
    const stages = await Promise.all(
      levels.map((level, index) =>
        StageManager.createStage({
          id: randomUUID(),
          tournament: tournamentId,
          bracket: null,
          level,
          index,
          createdAt: new Date(),
          updatedAt: null,
          deletedAt: null,
        })
      )
    )

    // ASSERT
    for (let i = 0; i < stages.length; i++) {
      expect(stages[i].level).toBe(levels[i])
      expect(stages[i].tournament).toBe(tournamentId)
    }
  })

  it('should handle stage with high index value', async () => {
    // ARRANGE: Create a tournament first
    const { tournamentId } = await createTestTournament()
    const stageId = randomUUID()
    const highIndex = 999

    // ACT
    const createdStage = await StageManager.createStage({
      id: stageId,
      tournament: tournamentId,
      bracket: null,
      level: 'final',
      index: highIndex,
      createdAt: new Date(),
      updatedAt: null,
      deletedAt: null,
    })

    const retrieved = await StageManager.getStage(stageId)

    // ASSERT
    expect(createdStage.index).toBe(highIndex)
    expect(retrieved.index).toBe(highIndex)
  })

  it('should create stage with sixteen level', async () => {
    // ARRANGE: Create a tournament first
    const { tournamentId } = await createTestTournament()
    const stageId = randomUUID()

    // ACT
    const createdStage = await StageManager.createStage({
      id: stageId,
      tournament: tournamentId,
      bracket: null,
      level: 'sixteen',
      index: 0,
      createdAt: new Date(),
      updatedAt: null,
      deletedAt: null,
    })

    const retrieved = await StageManager.getStage(stageId)

    // ASSERT
    expect(createdStage.level).toBe('sixteen')
    expect(retrieved.level).toBe('sixteen')
  })
})

describe('StageManager - Error Handling', () => {
  beforeEach(async () => {
    await clearDB()
  })

  it('should throw with descriptive error for non-existent stage', async () => {
    // ACT & ASSERT
    const fakeId = randomUUID()
    try {
      await StageManager.getStage(fakeId)
      throw new Error('Should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect(String(error)).toContain('ikke')
    }
  })

  it('should throw for invalid stage level in getStageLevel', async () => {
    // ACT & ASSERT
    expect(() => StageManager.getStageLevel(7)).toThrow(
      'Invalid matches in round: 7'
    )
    expect(() => StageManager.getStageLevel(0)).toThrow(
      'Invalid matches in round: 0'
    )
    expect(() => StageManager.getStageLevel(-5)).toThrow(
      'Invalid matches in round: -5'
    )
  })

  it('should handle concurrent stage creation', async () => {
    // ARRANGE: Create a tournament first
    const { tournamentId } = await createTestTournament()
    const stageIds = Array.from({ length: 5 }, () => randomUUID())

    // ACT: Create multiple stages concurrently
    const createdStages = await Promise.all(
      stageIds.map((id, index) =>
        StageManager.createStage({
          id,
          tournament: tournamentId,
          bracket: null,
          level: 'final',
          index,
          createdAt: new Date(),
          updatedAt: null,
          deletedAt: null,
        })
      )
    )

    // ASSERT
    expect(createdStages).toHaveLength(5)
    for (const stage of createdStages) {
      const retrieved = await StageManager.getStage(stage.id)
      expect(retrieved.id).toBe(stage.id)
    }
  })

  it('should handle concurrent stage retrieval', async () => {
    // ARRANGE: Create a tournament and stage first
    const { tournamentId } = await createTestTournament()
    const stageId = randomUUID()
    await StageManager.createStage({
      id: stageId,
      tournament: tournamentId,
      bracket: null,
      level: 'final',
      index: 0,
      createdAt: new Date(),
      updatedAt: null,
      deletedAt: null,
    })

    // ACT: Retrieve the same stage concurrently
    const retrievedStages = await Promise.all(
      Array.from({ length: 5 }, () => StageManager.getStage(stageId))
    )

    // ASSERT
    expect(retrievedStages).toHaveLength(5)
    for (const stage of retrievedStages) {
      expect(stage.id).toBe(stageId)
    }
  })
})

describe('StageManager - Dependency Names', () => {
  beforeEach(async () => {
    await clearDB()
  })

  it('should generate descriptive dependency names for match dependencies', async () => {
    // ARRANGE: Create a tournament with bracket stages
    await createTestTournament()

    // Get all tournaments to access the one we just created
    const tournaments = await TournamentManager.getAll()
    expect(tournaments.length).toBeGreaterThan(0)

    // ASSERT: Verify that dependency names are properly formatted strings
    for (const tournament of tournaments) {
      // Find stages with matches that have dependencies
      for (const stage of tournament.stages) {
        for (const match of stage.matches) {
          if (match.dependencyNames) {
            // Should have both A and B dependencies
            expect(match.dependencyNames).toHaveProperty('A')
            expect(match.dependencyNames).toHaveProperty('B')

            // Both should be non-empty strings
            expect(typeof match.dependencyNames.A).toBe('string')
            expect(typeof match.dependencyNames.B).toBe('string')
            expect(match.dependencyNames.A.length).toBeGreaterThan(0)
            expect(match.dependencyNames.B.length).toBeGreaterThan(0)

            const depA = match.dependencyNames.A
            const depB = match.dependencyNames.B

            // Verify format for each dependency type
            const isValidDependency = (dep: string) =>
              dep.includes('Vinner av') ||
              dep.includes('Taper av') ||
              dep.includes('plass fra')

            expect(isValidDependency(depA)).toBe(true)
            expect(isValidDependency(depB)).toBe(true)

            // Check group dependencies have correct format and no off-by-one errors
            if (depA.includes('plass fra')) {
              // Format should be "{rank}. plass fra Gruppe {letter}"
              // Valid ranks are 1, 2, 3, etc. (NOT 0)
              const rankMatch = depA.match(/^(\d+)\. plass fra Gruppe/)
              expect(rankMatch).not.toBeNull()
              if (rankMatch) {
                const rank = parseInt(rankMatch[1], 10)
                expect(rank).toBeGreaterThanOrEqual(1)
                expect(rank).toBeLessThanOrEqual(4) // Max advancement count
              }

              // Should have valid group letter (A, B, C, D, etc.)
              expect(/Gruppe [A-D]$/.test(depA)).toBe(true)
            }

            if (depB.includes('plass fra')) {
              // Format should be "{rank}. plass fra Gruppe {letter}"
              // Valid ranks are 1, 2, 3, etc. (NOT 0)
              const rankMatch = depB.match(/^(\d+)\. plass fra Gruppe/)
              expect(rankMatch).not.toBeNull()
              if (rankMatch) {
                const rank = parseInt(rankMatch[1], 10)
                expect(rank).toBeGreaterThanOrEqual(1)
                expect(rank).toBeLessThanOrEqual(4) // Max advancement count
              }

              // Should have valid group letter (A, B, C, D, etc.)
              expect(/Gruppe [A-D]$/.test(depB)).toBe(true)
            }

            // Check match dependencies have correct format
            if (depA.includes('Vinner av') || depA.includes('Taper av')) {
              // Format should be "{Vinner|Taper} av {Stage}, match {number}"
              expect(/^(Vinner|Taper) av .+, match \d+$/.test(depA)).toBe(true)
            }

            if (depB.includes('Vinner av') || depB.includes('Taper av')) {
              // Format should be "{Vinner|Taper} av {Stage}, match {number}"
              expect(/^(Vinner|Taper) av .+, match \d+$/.test(depB)).toBe(true)
            }
          }
        }
      }
    }
  })
})

async function createTestTournament() {
  // Create admin socket
  const { socket } = await createMockAdmin()

  // Create users
  const [user1, user2] = await registerMockUsers(socket, 2)

  // Setup ratings for users so tournament creation works
  setupRatings([
    { userId: user1.id, rating: 1000 },
    { userId: user2.id, rating: 990 },
  ])

  // Create session with participants
  const sessionId = await createSessionMock(socket, [user1.id, user2.id])

  // Create tournament
  const tournamentId = randomUUID()
  await TournamentManager.onCreateTournament(socket, {
    type: 'CreateTournamentRequest',
    id: tournamentId,
    session: sessionId,
    name: 'Test',
    description: 'A test tournament',
    groupsCount: 1,
    advancementCount: 1,
    eliminationType: 'single',
  })

  return {
    socket,
    user1,
    user2,
    sessionId,
    tournamentId,
  }
}
