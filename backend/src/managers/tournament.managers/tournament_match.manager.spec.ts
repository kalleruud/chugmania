import { describe, expect, it, vi } from 'vitest'

// Mock the database and auth dependencies before importing the manager
vi.mock('@backend/database/database', () => ({
  default: {
    query: {
      stages: { findMany: vi.fn() },
      tournamentMatches: { findMany: vi.fn() },
      matches: { findMany: vi.fn() },
      matchDependencies: { findMany: vi.fn() },
    },
  },
}))

vi.mock('../match.manager', () => ({
  default: {
    setPlayer: vi.fn(),
    getProgressedUser: vi.fn(),
  },
}))

vi.mock('./group.manager', () => ({
  default: {
    getUserAt: vi.fn(),
  },
}))

// Now import the manager after mocks are set up
import TournamentMatchManager from './tournament_match.manager'

describe('TournamentMatchManager', () => {
  describe('getStageLevel', () => {
    it('returns "final" for 1 match', () => {
      expect(TournamentMatchManager.getStageLevel(1)).toBe('final')
    })

    it('returns "semi" for 2 matches', () => {
      expect(TournamentMatchManager.getStageLevel(2)).toBe('semi')
    })

    it('returns "quarter" for 4 matches', () => {
      expect(TournamentMatchManager.getStageLevel(4)).toBe('quarter')
    })

    it('returns "eight" for 8 matches', () => {
      expect(TournamentMatchManager.getStageLevel(8)).toBe('eight')
    })

    it('returns "sixteen" for 16 matches', () => {
      expect(TournamentMatchManager.getStageLevel(16)).toBe('sixteen')
    })

    it('throws for invalid match count', () => {
      expect(() => TournamentMatchManager.getStageLevel(3)).toThrow()
      expect(() => TournamentMatchManager.getStageLevel(0)).toThrow()
      expect(() => TournamentMatchManager.getStageLevel(32)).toThrow()
    })
  })

  describe('calculateMinMaxMatchesPerPlayer', () => {
    it('returns 0 for groups with less than 2 players', () => {
      const result = TournamentMatchManager.calculateMinMaxMatchesPerPlayer({
        groups: [
          {
            id: 'g1',
            players: [],
            index: 0,
            tournament: 't1',
            createdAt: new Date(),
            updatedAt: null,
            deletedAt: null,
          },
        ],
        advancementCount: 1,
        eliminationType: 'single',
      })
      expect(result).toEqual({ min: 0, max: 0 })
    })

    it('calculates correct matches for single elimination with 2 groups of 4', () => {
      const players = [
        {
          id: 'p1',
          user: 'u1',
          group: 'g1',
          seed: 100,
          createdAt: new Date(),
          updatedAt: null,
          deletedAt: null,
          wins: 0,
          losses: 0,
        },
        {
          id: 'p2',
          user: 'u2',
          group: 'g1',
          seed: 90,
          createdAt: new Date(),
          updatedAt: null,
          deletedAt: null,
          wins: 0,
          losses: 0,
        },
        {
          id: 'p3',
          user: 'u3',
          group: 'g1',
          seed: 80,
          createdAt: new Date(),
          updatedAt: null,
          deletedAt: null,
          wins: 0,
          losses: 0,
        },
        {
          id: 'p4',
          user: 'u4',
          group: 'g1',
          seed: 70,
          createdAt: new Date(),
          updatedAt: null,
          deletedAt: null,
          wins: 0,
          losses: 0,
        },
      ]
      const result = TournamentMatchManager.calculateMinMaxMatchesPerPlayer({
        groups: [
          {
            id: 'g1',
            players,
            index: 0,
            tournament: 't1',
            createdAt: new Date(),
            updatedAt: null,
            deletedAt: null,
          },
          {
            id: 'g2',
            players,
            index: 1,
            tournament: 't1',
            createdAt: new Date(),
            updatedAt: null,
            deletedAt: null,
          },
        ],
        advancementCount: 2,
        eliminationType: 'single',
      })
      // Group stage: 4-1 = 3 matches per player (round robin)
      // Bracket: 4 advancing players = bracket of 4, so 2 rounds
      // Single elim: min = 3, max = 3 + 2 = 5
      expect(result.min).toBe(3)
      expect(result.max).toBe(5)
    })

    it('calculates correct matches for double elimination', () => {
      const players = [
        {
          id: 'p1',
          user: 'u1',
          group: 'g1',
          seed: 100,
          createdAt: new Date(),
          updatedAt: null,
          deletedAt: null,
          wins: 0,
          losses: 0,
        },
        {
          id: 'p2',
          user: 'u2',
          group: 'g1',
          seed: 90,
          createdAt: new Date(),
          updatedAt: null,
          deletedAt: null,
          wins: 0,
          losses: 0,
        },
        {
          id: 'p3',
          user: 'u3',
          group: 'g1',
          seed: 80,
          createdAt: new Date(),
          updatedAt: null,
          deletedAt: null,
          wins: 0,
          losses: 0,
        },
        {
          id: 'p4',
          user: 'u4',
          group: 'g1',
          seed: 70,
          createdAt: new Date(),
          updatedAt: null,
          deletedAt: null,
          wins: 0,
          losses: 0,
        },
      ]
      const result = TournamentMatchManager.calculateMinMaxMatchesPerPlayer({
        groups: [
          {
            id: 'g1',
            players,
            index: 0,
            tournament: 't1',
            createdAt: new Date(),
            updatedAt: null,
            deletedAt: null,
          },
          {
            id: 'g2',
            players,
            index: 1,
            tournament: 't1',
            createdAt: new Date(),
            updatedAt: null,
            deletedAt: null,
          },
        ],
        advancementCount: 2,
        eliminationType: 'double',
      })
      // Group stage: 4-1 = 3 matches
      // Double elim: rounds + 2 = 2 + 2 = 4
      // min = 3, max = 3 + 4 = 7
      expect(result.min).toBe(3)
      expect(result.max).toBe(7)
    })
  })

  describe('createGroupMatches', () => {
    it('creates round-robin matches for a single group', () => {
      const groups = [{ id: 'g1' }]
      const groupPlayers = [
        { id: 'gp1', group: 'g1', user: 'u1', seed: 100 },
        { id: 'gp2', group: 'g1', user: 'u2', seed: 90 },
        { id: 'gp3', group: 'g1', user: 'u3', seed: 80 },
      ]

      const result = TournamentMatchManager.createGroupMatches(
        'tournament-1',
        'session-1',
        groups,
        groupPlayers
      )

      // 3 players = 3 matches in round robin (n*(n-1)/2 = 3*2/2 = 3)
      expect(result.matches.length).toBe(3)
      expect(result.tournamentMatches.length).toBe(3)
      expect(result.stages.length).toBeGreaterThan(0)
      expect(result.matchDependencies.length).toBe(0)

      // Each match should have two different users
      for (const match of result.matches) {
        expect(match.userA).toBeDefined()
        expect(match.userB).toBeDefined()
        expect(match.userA).not.toBe(match.userB)
      }
    })

    it('creates matches for multiple groups', () => {
      const groups = [{ id: 'g1' }, { id: 'g2' }]
      const groupPlayers = [
        { id: 'gp1', group: 'g1', user: 'u1', seed: 100 },
        { id: 'gp2', group: 'g1', user: 'u2', seed: 90 },
        { id: 'gp3', group: 'g2', user: 'u3', seed: 80 },
        { id: 'gp4', group: 'g2', user: 'u4', seed: 70 },
      ]

      const result = TournamentMatchManager.createGroupMatches(
        'tournament-1',
        'session-1',
        groups,
        groupPlayers
      )

      // Group 1: 2 players = 1 match
      // Group 2: 2 players = 1 match
      // Total: 2 matches
      expect(result.matches.length).toBe(2)
    })

    it('assigns tracks cyclically by round', () => {
      const groups = [{ id: 'g1' }]
      const groupPlayers = [
        { id: 'gp1', group: 'g1', user: 'u1', seed: 100 },
        { id: 'gp2', group: 'g1', user: 'u2', seed: 90 },
        { id: 'gp3', group: 'g1', user: 'u3', seed: 80 },
        { id: 'gp4', group: 'g1', user: 'u4', seed: 70 },
      ]
      const tracks = ['track-1', 'track-2']

      const result = TournamentMatchManager.createGroupMatches(
        'tournament-1',
        'session-1',
        groups,
        groupPlayers,
        tracks
      )

      // All matches should have tracks assigned
      for (const match of result.matches) {
        expect(tracks).toContain(match.track)
      }
    })
  })

  describe('generateBracketMatches', () => {
    it('generates single elimination bracket for 4 advancing players', () => {
      const groups = [
        {
          id: 'g1',
          index: 0,
          tournament: 't1',
          createdAt: new Date(),
          updatedAt: null,
          deletedAt: null,
        },
        {
          id: 'g2',
          index: 1,
          tournament: 't1',
          createdAt: new Date(),
          updatedAt: null,
          deletedAt: null,
        },
      ]

      const result = TournamentMatchManager.generateBracketMatches(
        'tournament-1',
        'session-1',
        groups,
        2, // advancementCount
        'single',
        1 // groupStageCount
      )

      // 4 players = bracket of 4: 2 semi matches + 1 final = 3 matches
      expect(result.matches.length).toBe(3)
      expect(result.stages.length).toBe(2) // Semi and Final stages
      expect(result.matchDependencies.length).toBeGreaterThan(0)
    })

    it('generates double elimination bracket', () => {
      const groups = [
        {
          id: 'g1',
          index: 0,
          tournament: 't1',
          createdAt: new Date(),
          updatedAt: null,
          deletedAt: null,
        },
        {
          id: 'g2',
          index: 1,
          tournament: 't1',
          createdAt: new Date(),
          updatedAt: null,
          deletedAt: null,
        },
      ]

      const result = TournamentMatchManager.generateBracketMatches(
        'tournament-1',
        'session-1',
        groups,
        2, // advancementCount
        'double',
        1 // groupStageCount
      )

      // Double elimination has more matches than single
      expect(result.matches.length).toBeGreaterThan(3)
      // Should have upper, lower, and grand final stages
      const hasGrandFinal = result.stages.some(s => s.level === 'grand_final')
      expect(hasGrandFinal).toBe(true)
    })

    it('creates snake-style seeding dependencies from groups', () => {
      const groups = [
        {
          id: 'g1',
          index: 0,
          tournament: 't1',
          createdAt: new Date(),
          updatedAt: null,
          deletedAt: null,
        },
        {
          id: 'g2',
          index: 1,
          tournament: 't1',
          createdAt: new Date(),
          updatedAt: null,
          deletedAt: null,
        },
      ]

      const result = TournamentMatchManager.generateBracketMatches(
        'tournament-1',
        'session-1',
        groups,
        2, // advancementCount: top 2 from each group
        'single',
        1
      )

      // Check that dependencies exist from groups
      const groupDeps = result.matchDependencies.filter(
        d => d.fromGroup !== null
      )
      expect(groupDeps.length).toBeGreaterThan(0)

      // First match should have slot A from group 1 rank 1, slot B from group 2 rank 2
      const firstMatchTM = result.tournamentMatches[0]
      const firstMatchDeps = result.matchDependencies.filter(
        d => d.toMatch === firstMatchTM.id
      )
      expect(firstMatchDeps.length).toBe(2)

      const slotA = firstMatchDeps.find(d => d.toSlot === 'A')
      const slotB = firstMatchDeps.find(d => d.toSlot === 'B')
      expect(slotA?.fromPosition).toBe(1) // Rank 1 from group A
      expect(slotB?.fromPosition).toBe(2) // Rank 2 from group B (snake seeding)
    })

    it('assigns bracket tracks to stages in double elimination', () => {
      const groups = [
        {
          id: 'g1',
          index: 0,
          tournament: 't1',
          createdAt: new Date(),
          updatedAt: null,
          deletedAt: null,
        },
        {
          id: 'g2',
          index: 1,
          tournament: 't1',
          createdAt: new Date(),
          updatedAt: null,
          deletedAt: null,
        },
      ]
      const bracketTracks = [
        'track-a',
        'track-b',
        'track-c',
        'track-d',
        'track-e',
        'track-f',
      ]

      const result = TournamentMatchManager.generateBracketMatches(
        'tournament-1',
        'session-1',
        groups,
        2,
        'double', // Double elimination has track assignment after interleaving
        1,
        bracketTracks
      )

      // All matches should have tracks assigned
      for (const match of result.matches) {
        expect(bracketTracks).toContain(match.track)
      }
    })

    it('single elimination has null tracks when no bracket tracks provided', () => {
      const groups = [
        {
          id: 'g1',
          index: 0,
          tournament: 't1',
          createdAt: new Date(),
          updatedAt: null,
          deletedAt: null,
        },
        {
          id: 'g2',
          index: 1,
          tournament: 't1',
          createdAt: new Date(),
          updatedAt: null,
          deletedAt: null,
        },
      ]

      const result = TournamentMatchManager.generateBracketMatches(
        'tournament-1',
        'session-1',
        groups,
        2,
        'single',
        1
      )

      // Single elimination without tracks should have null tracks
      for (const match of result.matches) {
        expect(match.track).toBeNull()
      }
    })

    it('handles large bracket with 8 advancing players', () => {
      const groups = [
        {
          id: 'g1',
          index: 0,
          tournament: 't1',
          createdAt: new Date(),
          updatedAt: null,
          deletedAt: null,
        },
        {
          id: 'g2',
          index: 1,
          tournament: 't1',
          createdAt: new Date(),
          updatedAt: null,
          deletedAt: null,
        },
      ]

      const result = TournamentMatchManager.generateBracketMatches(
        'tournament-1',
        'session-1',
        groups,
        4, // 4 advancing from each group = 8 total
        'single',
        1
      )

      // 8 players = bracket of 8: 4 quarter + 2 semi + 1 final = 7 matches
      expect(result.matches.length).toBe(7)
      expect(result.stages.length).toBe(3) // Quarter, Semi, Final

      // Check stage levels
      const levels = result.stages.map(s => s.level)
      expect(levels).toContain('quarter')
      expect(levels).toContain('semi')
      expect(levels).toContain('final')
    })

    it('interleaves upper and lower bracket stages in double elimination', () => {
      const groups = [
        {
          id: 'g1',
          index: 0,
          tournament: 't1',
          createdAt: new Date(),
          updatedAt: null,
          deletedAt: null,
        },
        {
          id: 'g2',
          index: 1,
          tournament: 't1',
          createdAt: new Date(),
          updatedAt: null,
          deletedAt: null,
        },
      ]

      const result = TournamentMatchManager.generateBracketMatches(
        'tournament-1',
        'session-1',
        groups,
        4, // 4 advancing from each group = 8 total
        'double',
        1
      )

      // Stages should be interleaved: upper, lower, upper, lower, ..., grand final
      // The first stage should be upper bracket
      expect(result.stages[0].bracket).toBe('upper')

      // Grand final should be last
      const lastStage = result.stages.at(-1)
      expect(lastStage?.level).toBe('grand_final')
    })
  })
})
