import type { EliminationType } from '@backend/database/schema'
import type { GroupWithPlayers } from '@common/models/tournament'
import { describe, expect, it } from 'vitest'
import TournamentMatchManager from './tournament_match.manager'

describe('calculateMinMaxMatchesPerPlayer', () => {
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
    // Single elimination - advancement count variations
    {
      groups: [createGroup(4), createGroup(4)],
      advancementCount: 1,
      eliminationType: 'single',
      expected: { min: 3, max: 4 },
    },
    {
      groups: [createGroup(4), createGroup(4)],
      advancementCount: 3,
      eliminationType: 'single',
      expected: { min: 3, max: 6 },
    },
    {
      groups: [createGroup(4), createGroup(4), createGroup(4)],
      advancementCount: 2,
      eliminationType: 'single',
      expected: { min: 3, max: 6 },
    },
    // Single elimination - edge cases
    {
      groups: [createGroup(1)],
      advancementCount: 1,
      eliminationType: 'single',
      expected: { min: 0, max: 0 },
    },
    {
      groups: [createGroup(1), createGroup(1)],
      advancementCount: 1,
      eliminationType: 'single',
      expected: { min: 0, max: 0 },
    },
    {
      groups: [createGroup(0)],
      advancementCount: 1,
      eliminationType: 'single',
      expected: { min: 0, max: 0 },
    },
    {
      groups: [createGroup(2)],
      advancementCount: 1,
      eliminationType: 'single',
      expected: { min: 1, max: 1 },
    },
    {
      groups: [createGroup(3), createGroup(5), createGroup(4)],
      advancementCount: 2,
      eliminationType: 'single',
      expected: { min: 4, max: 7 },
    },
    // Double elimination - basic cases
    {
      groups: [createGroup(4)],
      advancementCount: 2,
      eliminationType: 'double',
      expected: { min: 3, max: 6 },
    },
    {
      groups: [createGroup(4), createGroup(4)],
      advancementCount: 2,
      eliminationType: 'double',
      expected: { min: 3, max: 7 },
    },
    {
      groups: [createGroup(8)],
      advancementCount: 2,
      eliminationType: 'double',
      expected: { min: 7, max: 10 },
    },
    // Double elimination - advancement count variations
    {
      groups: [createGroup(4), createGroup(4)],
      advancementCount: 1,
      eliminationType: 'double',
      expected: { min: 3, max: 6 },
    },
    {
      groups: [createGroup(6), createGroup(6)],
      advancementCount: 4,
      eliminationType: 'double',
      expected: { min: 5, max: 10 },
    },
    // Double elimination - edge cases
    {
      groups: [createGroup(1)],
      advancementCount: 1,
      eliminationType: 'double',
      expected: { min: 0, max: 0 },
    },
    // Large groups
    {
      groups: [createGroup(32)],
      advancementCount: 8,
      eliminationType: 'single',
      expected: { min: 31, max: 34 },
    },
    {
      groups: [createGroup(16)],
      advancementCount: 4,
      eliminationType: 'double',
      expected: { min: 15, max: 19 },
    },
    // Custom tests
    {
      groups: [createGroup(5), createGroup(5), createGroup(5), createGroup(4)],
      advancementCount: 2,
      eliminationType: 'double',
      expected: { min: 3, max: 19 },
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

// Helper functions

function createGroup(playerCount: number): GroupWithPlayers {
  return {
    id: `group-${Math.random()}`,
    tournament: 'test-tournament',
    index: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    players: Array.from({ length: playerCount }, (_, idx) => ({
      id: `player-${idx}`,
      group: `group-${idx}`,
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
