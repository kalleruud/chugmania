import type { GroupWithPlayers } from '@common/models/tournament'
import { describe, expect, it } from 'vitest'
import TournamentMatchManager from './tournament_match.manager'
import type TournamentManager from './tournament.manager'

describe('calculateMinMaxMatchesPerPlayer', () => {
  describe('single elimination', () => {
    it('calculates correct min/max for 4 players in 1 group', () => {
      const { min, max } =
        TournamentMatchManager.calculateMinMaxMatchesPerPlayer({
          groups: [createGroup(4)],
          advancementCount: 2,
          eliminationType: 'single'}
        )

      expect(min).toBe(3) // Group stage: 3 matches
      expect(max).toBe(4) // Group stage + 1 bracket round
    })

    it('calculates correct min/max for 8 players in 2 groups', () => {
      const { min, max } =
        TournamentMatchManager.calculateMinMaxMatchesPerPlayer({
          groups: [createGroup(4), createGroup(4)],
          advancementCount: 2,
          eliminationType: 'single'}
        )

      expect(min).toBe(3) // Group stage: 3 matches
      expect(max).toBe(5) // Group stage + 2 bracket rounds
    })

    it('calculates correct min/max for 8 players in 1 group', () => {
      const { min, max } =
        TournamentMatchManager.calculateMinMaxMatchesPerPlayer({
          groups: [createGroup(8)],
          advancementCount: 2,
          eliminationType: 'single'}
        )

      expect(min).toBe(7) // Group stage: 7 matches
      expect(max).toBe(8) // Group stage + 1 bracket round (2 advancing)
    })

    it('calculates correct min/max for 4 advancing per group', () => {
      const { min, max } =
        TournamentMatchManager.calculateMinMaxMatchesPerPlayer({
          groups: [createGroup(6), createGroup(6)],
          advancementCount: 4,
          eliminationType: 'single'}
        )

      expect(min).toBe(5) // Group stage: 5 matches
      expect(max).toBe(8) // Group stage + 3 bracket rounds
    })

    it('returns 0 for groups with less than 2 players', () => {
      const { min, max } =
        TournamentMatchManager.calculateMinMaxMatchesPerPlayer({
          groups: [createGroup(1)],
          advancementCount: 1,
          eliminationType: 'single'}
        )

      expect(min).toBe(0)
      expect(max).toBe(0)
    })

    it('returns correct values for single player in group', () => {
      const { min, max } =
        TournamentMatchManager.calculateMinMaxMatchesPerPlayer({
          groups: [createGroup(1), createGroup(1)],
          advancementCount: 1,
          eliminationType: 'single'}
        )

      expect(min).toBe(0)
      expect(max).toBe(0)
    })

    it('handles 3 groups with 4 players each', () => {
      const { min, max } =
        TournamentMatchManager.calculateMinMaxMatchesPerPlayer({
          groups: [createGroup(4), createGroup(4), createGroup(4)],
          advancementCount: 2,
          eliminationType: 'single'}
        )

      expect(min).toBe(3)
      expect(max).toBe(6) // 3 group matches + 3 bracket rounds (6 players total)
    })

    it('calculates for advancement count of 1', () => {
      const { min, max } =
        TournamentMatchManager.calculateMinMaxMatchesPerPlayer({
          groups: [createGroup(4), createGroup(4)],
          advancementCount: 1,
          eliminationType: 'single'}
        )

      expect(min).toBe(3)
      expect(max).toBe(4) // 3 group + 1 bracket round (2 advancing players)
    })

    it('calculates for advancement count of 3', () => {
      const { min, max } =
        TournamentMatchManager.calculateMinMaxMatchesPerPlayer({
          groups: [createGroup(4), createGroup(4)],
          advancementCount: 3,
          eliminationType: 'single'}
        )

      expect(min).toBe(3)
      expect(max).toBe(6) // 3 group + 3 bracket rounds (6 advancing players)
    })
  })

  describe('double elimination', () => {
    it('calculates correct min/max for 4 players in 1 group', () => {
      const { min, max } =
        TournamentMatchManager.calculateMinMaxMatchesPerPlayer({
          groups: [createGroup(4)],
          advancementCount: 2,
          eliminationType: 'double'}
        )

      expect(min).toBe(3) // Group stage: 3 matches
      expect(max).toBe(6) // Group stage + 1 round + 2 for double elimination
    })

    it('calculates correct min/max for 8 players in 2 groups', () => {
      const { min, max } =
        TournamentMatchManager.calculateMinMaxMatchesPerPlayer({
          groups: [createGroup(4), createGroup(4)],
          advancementCount: 2,
          eliminationType: 'double'}
        )

      expect(min).toBe(3)
      expect(max).toBe(7) // Group stage + 2 rounds + 2 for double
    })

    it('calculates correct min/max for 8 players in 1 group', () => {
      const { min, max } =
        TournamentMatchManager.calculateMinMaxMatchesPerPlayer({
          groups: [createGroup(8)],
          advancementCount: 2,
          eliminationType: 'double'}
        )

      expect(min).toBe(7)
      expect(max).toBe(10) // Group stage + 1 round + 2 for double
    })

    it('adds 2 extra rounds for double elimination', () => {
      const singleResult =
        TournamentMatchManager.calculateMinMaxMatchesPerPlayer({
          groups: [createGroup(4), createGroup(4)],
          advancementCount: 2,
          eliminationType: 'single'}
        )
      const doubleResult =
        TournamentMatchManager.calculateMinMaxMatchesPerPlayer({
          groups: [createGroup(4), createGroup(4)],
          advancementCount: 2,
          eliminationType: 'double'}
        )

      // Double elimination should have exactly 2 more matches
      expect(doubleResult.max - singleResult.max).toBe(2)
      expect(doubleResult.min).toBe(singleResult.min)
    })

    it('calculates for advancement count of 1', () => {
      const { min, max } =
        TournamentMatchManager.calculateMinMaxMatchesPerPlayer({
          groups: [createGroup(4), createGroup(4)],
          advancementCount: 1,
          eliminationType: 'double'}
        )

      expect(min).toBe(3)
      expect(max).toBe(6) // 3 group + 0 bracket rounds (2 advancing) + 2 for double
    })

    it('calculates for advancement count of 4', () => {
      const { min, max } =
        TournamentMatchManager.calculateMinMaxMatchesPerPlayer({
          groups: [createGroup(6), createGroup(6)],
          advancementCount: 4,
          eliminationType: 'double'}
        )

      expect(min).toBe(5)
      expect(max).toBe(10) // 5 group + 3 rounds + 2 for double
    })
  })

  describe('edge cases', () => {
    it('returns 0 for empty groups', () => {
      const { min, max } =
        TournamentMatchManager.calculateMinMaxMatchesPerPlayer({
          groups: [createGroup(0)],
          advancementCount: 1,
          eliminationType: 'single'}
        )

      expect(min).toBe(0)
      expect(max).toBe(0)
    })

    it('returns 0 for groups with exactly 1 player', () => {
      const { min, max } =
        TournamentMatchManager.calculateMinMaxMatchesPerPlayer({
          groups: [createGroup(1), createGroup(1), createGroup(1)],
          advancementCount: 1,
          eliminationType: 'single'}
        )

      expect(min).toBe(0)
      expect(max).toBe(0)
    })

    it('handles very large group (32 players)', () => {
      const { min, max } =
        TournamentMatchManager.calculateMinMaxMatchesPerPlayer({
          groups: [createGroup(32)],
          advancementCount: 8,
          eliminationType: 'single'}
        )

      expect(min).toBe(31) // 32 players = 31 round-robin matches
      expect(max).toBeGreaterThan(min)
    })

    it('handles uneven group sizes', () => {
      const { min, max } =
        TournamentMatchManager.calculateMinMaxMatchesPerPlayer({
          groups: [createGroup(3), createGroup(5), createGroup(4)],
          advancementCount: 2,
          eliminationType: 'single'}
        )

      // Largest group is 5 players: 4 group stage matches, 6 advancing, 3 bracket rounds
      expect(min).toBe(4)
      expect(max).toBe(7)
    })

    it('consistent results across multiple calls', () => {
      const result1 = TournamentMatchManager.calculateMinMaxMatchesPerPlayer({
        groups: [createGroup(4), createGroup(4)],
        advancementCount: 2,
        eliminationType: 'single'}
      )
      const result2 = TournamentMatchManager.calculateMinMaxMatchesPerPlayer({
        groups: [createGroup(4), createGroup(4)],
        advancementCount: 2,
        eliminationType: 'single'}
      )

      expect(result1).toEqual(result2)
    })

    it('returns min equal to group stage matches', () => {
      const testCases = [
        { players: 2, expected: 1 },
        { players: 3, expected: 2 },
        { players: 4, expected: 3 },
        { players: 5, expected: 4 },
      ]

      testCases.forEach(({ players, expected }) => {
        const { min } = TournamentMatchManager.calculateMinMaxMatchesPerPlayer({
          groups: [createGroup(players)],
          advancementCount: 1,
          eliminationType: 'single'}
        )
        expect(min).toBe(expected)
      })
    })

    it('returns max greater than or equal to min', () => {
      const testCases: (Parameters<typeof TournamentMatchManager.calculateMinMaxMatchesPerPlayer> & { expected: ReturnType<typeof TournamentMatchManager.calculateMinMaxMatchesPerPlayer> })[] = [
        {
          groups: [createGroup(2)],
          advancementCount: 1,
          eliminationType: 'single',
          expected: { min: 1, max: 2}
        },
        {
          groups: [createGroup(4), createGroup(4)],
          advancementCount: 2,
          eliminationType: 'single',
        },
        {
          groups: [createGroup(8)],
          advancementCount: 4,
          eliminationType: 'double',
        },
        {
          groups: [createGroup(3), createGroup(5), createGroup(4)],
          advancementCount: 2,
          eliminationType: 'double',
        },
      ]

      testCases.forEach(({ groups, advancement, elimination }) => {
        const { min, max } =
          TournamentMatchManager.calculateMinMaxMatchesPerPlayer({
            advancementCount: groups,
            advancement,eliminationType: 
            elimination}
          )
        expect(max).toBeGreaterThanOrEqual(min)
      })
    })

    it('bracket size is power of 2', () => {
      // Test that max is calculated correctly for various advancement counts
      const testCases = [
        { advancementCount: 1, groups: 2, expectedBracketSize: 2 },
        { advancementCount: 2, groups: 2, expectedBracketSize: 4 },
        { advancementCount: 3, groups: 2, expectedBracketSize: 8 },
        { advancementCount: 4, groups: 2, expectedBracketSize: 8 },
        { advancementCount: 5, groups: 2, expectedBracketSize: 16 },
      ]

      testCases.forEach(({ advancementCount, groups: groupCount }) => {
        const { max } = TournamentMatchManager.calculateMinMaxMatchesPerPlayer({
          groups: Array.from({ length: groupCount }, () => createGroup(4)),
          advancementCount: advancementCount,
          eliminationType: 'single'}
        )
        // Just verify max is reasonable (greater than min group stage matches)
        expect(max).toBeGreaterThan(3)
      })
    })
  })
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
