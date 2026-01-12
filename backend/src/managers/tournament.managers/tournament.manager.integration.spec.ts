import type { SessionSignup } from '@common/models/session'
import type {
  TournamentPreviewResponse,
  TournamentWithDetails,
} from '@common/models/tournament'
import type { UserInfo } from '@common/models/user'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@backend/database/database', () => ({
  default: {
    query: {
      tournaments: { findFirst: vi.fn() },
      groups: { findMany: vi.fn() },
      groupPlayers: { findMany: vi.fn() },
      stages: { findMany: vi.fn() },
      tournamentMatches: { findMany: vi.fn() },
      matches: { findMany: vi.fn() },
      matchDependencies: { findMany: vi.fn() },
    },
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }),
  },
  database: {
    transaction: vi.fn(),
  },
}))

vi.mock('../../server', () => ({
  broadcast: vi.fn(),
}))

vi.mock('../auth.manager', () => ({
  default: {
    checkAuth: vi.fn().mockResolvedValue({ id: 'admin', role: 'admin' }),
  },
}))

vi.mock('../session.manager', () => ({
  default: {
    getSessionSignups: vi.fn(),
  },
}))

vi.mock('../rating.manager', () => ({
  default: {
    getUserRatings: vi.fn(),
  },
}))

vi.mock('../match.manager', () => ({
  default: {
    getAllMatches: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('../user.manager', () => ({
  default: {
    getUserById: vi.fn((id: string) =>
      Promise.resolve({
        id,
        firstName: `Player`,
        lastName: id,
        email: `${id}@test.com`,
        shortName: id.toUpperCase(),
        role: 'user',
        createdAt: new Date(),
        updatedAt: null,
        deletedAt: null,
      })
    ),
  },
}))

import type { TypedSocket } from '../../server'
import RatingManager from '../rating.manager'
import SessionManager from '../session.manager'
import TournamentManager from './tournament.manager'

function createMockSocket(): TypedSocket {
  return {
    id: 'test-socket-id',
    data: { user: { id: 'admin', role: 'admin' } },
  } as unknown as TypedSocket
}

function createTestUserInfo(id: string, index: number): UserInfo {
  return {
    id,
    firstName: `Player`,
    lastName: `${index}`,
    email: `${id}@test.com`,
    shortName: id.toUpperCase(),
    role: 'user',
    createdAt: new Date(),
    updatedAt: null,
    deletedAt: null,
    passwordHash: undefined,
  }
}

function createTestPlayers(count: number): SessionSignup[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `signup-${i + 1}`,
    session: 'session-1',
    response: 'yes' as const,
    user: createTestUserInfo(`user-${i + 1}`, i + 1),
    createdAt: new Date(),
    updatedAt: null,
    deletedAt: null,
  }))
}

function setupMocks(playerCount: number) {
  const players = createTestPlayers(playerCount)

  vi.mocked(SessionManager.getSessionSignups).mockResolvedValue(players)

  vi.mocked(RatingManager.getUserRatings).mockImplementation(
    (userId: string) => {
      const index = parseInt(userId.replace('user-', ''), 10)
      return {
        user: userId,
        totalRating: 2000 - index * 100,
        matchRating: 2000 - index * 100,
        trackRating: 2000 - index * 100,
        ranking: index,
      }
    }
  )

  return players
}

function assertSuccess(
  result: Awaited<ReturnType<typeof TournamentManager.onGetTournamentPreview>>
): asserts result is TournamentPreviewResponse {
  expect(result.success).toBe(true)
  if (!result.success) throw new Error('Expected success')
}

function getTournament(
  result: Awaited<ReturnType<typeof TournamentManager.onGetTournamentPreview>>
): TournamentWithDetails {
  assertSuccess(result)
  return result.tournament
}

describe('TournamentManager.onGetTournamentPreview - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic tournament setups', () => {
    it('creates 4-player / 2-group / single elimination tournament', async () => {
      setupMocks(4)

      const result = await TournamentManager.onGetTournamentPreview(
        createMockSocket(),
        {
          type: 'TournamentPreviewRequest',
          session: 'session-1',
          name: 'Test Tournament',
          description: 'A test tournament',
          groupsCount: 2,
          advancementCount: 1,
          eliminationType: 'single',
        }
      )

      const tournament = getTournament(result)

      expect(tournament.groups.length).toBe(2)
      expect(tournament.groups[0].players.length).toBe(2)
      expect(tournament.groups[1].players.length).toBe(2)

      const groupStages = tournament.stages.filter(
        s => s.stage.level === 'group'
      )
      const bracketStages = tournament.stages.filter(
        s => s.stage.level !== 'group'
      )

      expect(groupStages.length).toBeGreaterThan(0)
      expect(bracketStages.length).toBe(1)
      expect(bracketStages[0].stage.level).toBe('final')
      expect(bracketStages[0].matches.length).toBe(1)
    })

    it('creates 8-player / 2-group / single elimination tournament', async () => {
      setupMocks(8)

      const result = await TournamentManager.onGetTournamentPreview(
        createMockSocket(),
        {
          type: 'TournamentPreviewRequest',
          session: 'session-1',
          name: 'Test Tournament',
          description: undefined,
          groupsCount: 2,
          advancementCount: 2,
          eliminationType: 'single',
        }
      )

      const tournament = getTournament(result)

      expect(tournament.groups.length).toBe(2)
      expect(tournament.groups[0].players.length).toBe(4)
      expect(tournament.groups[1].players.length).toBe(4)

      const bracketStages = tournament.stages.filter(
        s => s.stage.level !== 'group'
      )

      expect(bracketStages.length).toBe(2)

      const levels = bracketStages.map(s => s.stage.level)
      expect(levels).toContain('semi')
      expect(levels).toContain('final')
    })

    it('creates 8-player / 2-group / double elimination tournament', async () => {
      setupMocks(8)

      const result = await TournamentManager.onGetTournamentPreview(
        createMockSocket(),
        {
          type: 'TournamentPreviewRequest',
          session: 'session-1',
          name: 'Double Elim Tournament',
          description: '',
          groupsCount: 2,
          advancementCount: 2,
          eliminationType: 'double',
        }
      )

      const tournament = getTournament(result)

      const bracketStages = tournament.stages.filter(
        s => s.stage.level !== 'group'
      )

      const hasGrandFinal = bracketStages.some(
        s => s.stage.level === 'grand_final'
      )
      expect(hasGrandFinal).toBe(true)

      const upperBracketStages = bracketStages.filter(
        s => s.stage.bracket === 'upper'
      )
      const lowerBracketStages = bracketStages.filter(
        s => s.stage.bracket === 'lower'
      )
      expect(upperBracketStages.length).toBeGreaterThan(0)
      expect(lowerBracketStages.length).toBeGreaterThan(0)

      expect(tournament.maxMatchesPerPlayer).toBeGreaterThan(
        tournament.minMatchesPerPlayer
      )
    })
  })

  describe('Different advancement counts', () => {
    it('handles 1 player advancing per group', async () => {
      setupMocks(6)

      const result = await TournamentManager.onGetTournamentPreview(
        createMockSocket(),
        {
          type: 'TournamentPreviewRequest',
          session: 'session-1',
          name: 'Top 1 Tournament',
          groupsCount: 2,
          advancementCount: 1,
          eliminationType: 'single',
        }
      )

      const tournament = getTournament(result)

      const bracketStages = tournament.stages.filter(
        s => s.stage.level !== 'group'
      )
      expect(bracketStages.length).toBe(1)
      expect(bracketStages[0].stage.level).toBe('final')
      expect(bracketStages[0].matches.length).toBe(1)
    })

    it('handles 2 players advancing per group with 2 groups', async () => {
      setupMocks(8)

      const result = await TournamentManager.onGetTournamentPreview(
        createMockSocket(),
        {
          type: 'TournamentPreviewRequest',
          session: 'session-1',
          name: 'Top 2 Tournament',
          groupsCount: 2,
          advancementCount: 2,
          eliminationType: 'single',
        }
      )

      const tournament = getTournament(result)

      const bracketStages = tournament.stages.filter(
        s => s.stage.level !== 'group'
      )

      const totalBracketMatches = bracketStages.reduce(
        (sum, s) => sum + s.matches.length,
        0
      )
      expect(totalBracketMatches).toBe(3)
    })

    it('handles 4 players advancing per group', async () => {
      setupMocks(16)

      const result = await TournamentManager.onGetTournamentPreview(
        createMockSocket(),
        {
          type: 'TournamentPreviewRequest',
          session: 'session-1',
          name: 'Top 4 Tournament',
          groupsCount: 2,
          advancementCount: 4,
          eliminationType: 'single',
        }
      )

      const tournament = getTournament(result)

      const bracketStages = tournament.stages.filter(
        s => s.stage.level !== 'group'
      )

      const levels = bracketStages.map(s => s.stage.level)
      expect(levels).toContain('quarter')
      expect(levels).toContain('semi')
      expect(levels).toContain('final')

      const totalBracketMatches = bracketStages.reduce(
        (sum, s) => sum + s.matches.length,
        0
      )
      expect(totalBracketMatches).toBe(7)
    })
  })

  describe('Track assignments', () => {
    it('assigns group stage tracks when provided', async () => {
      setupMocks(4)

      const groupTracks = ['track-g1', 'track-g2']

      const result = await TournamentManager.onGetTournamentPreview(
        createMockSocket(),
        {
          type: 'TournamentPreviewRequest',
          session: 'session-1',
          name: 'Track Test Tournament',
          groupsCount: 2,
          advancementCount: 1,
          eliminationType: 'single',
          groupStageTracks: groupTracks,
        }
      )

      const tournament = getTournament(result)

      const groupStages = tournament.stages.filter(
        s => s.stage.level === 'group'
      )

      for (const stage of groupStages) {
        for (const match of stage.matches) {
          expect(groupTracks).toContain(match.matchDetails.track)
        }
      }
    })

    it('assigns bracket tracks when provided in double elimination', async () => {
      setupMocks(8)

      const bracketTracks = ['track-b1', 'track-b2', 'track-b3', 'track-b4']

      const result = await TournamentManager.onGetTournamentPreview(
        createMockSocket(),
        {
          type: 'TournamentPreviewRequest',
          session: 'session-1',
          name: 'Bracket Track Tournament',
          groupsCount: 2,
          advancementCount: 2,
          eliminationType: 'double',
          bracketTracks,
        }
      )

      const tournament = getTournament(result)

      const bracketStages = tournament.stages.filter(
        s => s.stage.level !== 'group'
      )

      for (const stage of bracketStages) {
        for (const match of stage.matches) {
          expect(bracketTracks).toContain(match.matchDetails.track)
        }
      }
    })

    it('has null tracks when no tracks provided', async () => {
      setupMocks(4)

      const result = await TournamentManager.onGetTournamentPreview(
        createMockSocket(),
        {
          type: 'TournamentPreviewRequest',
          session: 'session-1',
          name: 'No Tracks Tournament',
          groupsCount: 2,
          advancementCount: 1,
          eliminationType: 'single',
        }
      )

      const tournament = getTournament(result)

      for (const stage of tournament.stages) {
        for (const match of stage.matches) {
          expect(match.matchDetails.track).toBeNull()
        }
      }
    })
  })

  describe('Snake seeding verification', () => {
    it('seeds players using snake pattern across groups', async () => {
      setupMocks(8)

      const result = await TournamentManager.onGetTournamentPreview(
        createMockSocket(),
        {
          type: 'TournamentPreviewRequest',
          session: 'session-1',
          name: 'Snake Seed Tournament',
          groupsCount: 2,
          advancementCount: 2,
          eliminationType: 'single',
        }
      )

      const tournament = getTournament(result)

      const group0Players = tournament.groups[0].players
      const group1Players = tournament.groups[1].players

      const group0Seeds = group0Players.map(p => p.seed).sort((a, b) => b - a)
      const group1Seeds = group1Players.map(p => p.seed).sort((a, b) => b - a)

      expect(group0Seeds[0]).toBeGreaterThan(group1Seeds[0])
      expect(group1Seeds[1]).toBeGreaterThan(group0Seeds[1])
    })
  })

  describe('Match count calculations', () => {
    it('calculates min/max matches correctly for single elimination', async () => {
      setupMocks(8)

      const result = await TournamentManager.onGetTournamentPreview(
        createMockSocket(),
        {
          type: 'TournamentPreviewRequest',
          session: 'session-1',
          name: 'Match Count Test',
          groupsCount: 2,
          advancementCount: 2,
          eliminationType: 'single',
        }
      )

      const tournament = getTournament(result)

      expect(tournament.minMatchesPerPlayer).toBe(3)
      expect(tournament.maxMatchesPerPlayer).toBe(5)
    })

    it('calculates min/max matches correctly for double elimination', async () => {
      setupMocks(8)

      const result = await TournamentManager.onGetTournamentPreview(
        createMockSocket(),
        {
          type: 'TournamentPreviewRequest',
          session: 'session-1',
          name: 'Double Elim Match Count',
          groupsCount: 2,
          advancementCount: 2,
          eliminationType: 'double',
        }
      )

      const tournament = getTournament(result)

      expect(tournament.minMatchesPerPlayer).toBe(3)
      expect(tournament.maxMatchesPerPlayer).toBe(7)
    })
  })

  describe('Validation', () => {
    it('throws error for invalid request type', async () => {
      setupMocks(4)

      await expect(
        TournamentManager.onGetTournamentPreview(createMockSocket(), {
          type: 'InvalidRequestType',
          session: 'session-1',
          name: 'Test',
          groupsCount: 2,
          advancementCount: 1,
          eliminationType: 'single',
        } as any)
      ).rejects.toThrow()
    })

    it('throws error when name is missing', async () => {
      setupMocks(4)

      await expect(
        TournamentManager.onGetTournamentPreview(createMockSocket(), {
          type: 'TournamentPreviewRequest',
          session: 'session-1',
          groupsCount: 2,
          advancementCount: 1,
          eliminationType: 'single',
        } as any)
      ).rejects.toThrow()
    })
  })

  describe('Stage structure', () => {
    it('double elimination interleaves upper and lower bracket stages', async () => {
      setupMocks(16)

      const result = await TournamentManager.onGetTournamentPreview(
        createMockSocket(),
        {
          type: 'TournamentPreviewRequest',
          session: 'session-1',
          name: 'Interleave Test',
          groupsCount: 2,
          advancementCount: 4,
          eliminationType: 'double',
        }
      )

      const tournament = getTournament(result)

      const bracketStages = tournament.stages.filter(
        s => s.stage.level !== 'group'
      )

      expect(bracketStages[0].stage.bracket).toBe('upper')

      const grandFinal = bracketStages.at(-1)
      expect(grandFinal?.stage.level).toBe('grand_final')
    })

    it('creates correct dependency names for bracket matches', async () => {
      setupMocks(8)

      const result = await TournamentManager.onGetTournamentPreview(
        createMockSocket(),
        {
          type: 'TournamentPreviewRequest',
          session: 'session-1',
          name: 'Dependency Names Test',
          groupsCount: 2,
          advancementCount: 2,
          eliminationType: 'single',
        }
      )

      const tournament = getTournament(result)

      const semiStage = tournament.stages.find(s => s.stage.level === 'semi')
      expect(semiStage).toBeDefined()

      for (const match of semiStage!.matches) {
        expect(match.dependencyNames).not.toBeNull()
        expect(match.dependencyNames?.A).toBeDefined()
        expect(match.dependencyNames?.B).toBeDefined()
      }

      const finalStage = tournament.stages.find(s => s.stage.level === 'final')
      expect(finalStage).toBeDefined()

      for (const match of finalStage!.matches) {
        expect(match.dependencyNames).not.toBeNull()
      }
    })
  })

  describe('Edge cases', () => {
    it('handles minimum viable tournament (4 players, 2 groups)', async () => {
      setupMocks(4)

      const result = await TournamentManager.onGetTournamentPreview(
        createMockSocket(),
        {
          type: 'TournamentPreviewRequest',
          session: 'session-1',
          name: 'Minimum Tournament',
          groupsCount: 2,
          advancementCount: 1,
          eliminationType: 'single',
        }
      )

      const tournament = getTournament(result)

      expect(tournament.groups.length).toBe(2)
      expect(tournament.groups[0].players.length).toBe(2)
      expect(tournament.groups[1].players.length).toBe(2)

      const groupStages = tournament.stages.filter(
        s => s.stage.level === 'group'
      )
      const groupMatches = groupStages.reduce(
        (sum, s) => sum + s.matches.length,
        0
      )
      expect(groupMatches).toBe(2)
    })

    it('handles uneven player distribution (5 players, 2 groups)', async () => {
      setupMocks(5)

      const result = await TournamentManager.onGetTournamentPreview(
        createMockSocket(),
        {
          type: 'TournamentPreviewRequest',
          session: 'session-1',
          name: 'Uneven Tournament',
          groupsCount: 2,
          advancementCount: 1,
          eliminationType: 'single',
        }
      )

      const tournament = getTournament(result)

      const totalPlayers = tournament.groups.reduce(
        (sum, g) => sum + g.players.length,
        0
      )
      expect(totalPlayers).toBe(5)

      const group0Count = tournament.groups[0].players.length
      const group1Count = tournament.groups[1].players.length
      expect(Math.abs(group0Count - group1Count)).toBeLessThanOrEqual(1)
    })

    it('handles 3 groups', async () => {
      setupMocks(9)

      const result = await TournamentManager.onGetTournamentPreview(
        createMockSocket(),
        {
          type: 'TournamentPreviewRequest',
          session: 'session-1',
          name: '3 Group Tournament',
          groupsCount: 3,
          advancementCount: 1,
          eliminationType: 'single',
        }
      )

      const tournament = getTournament(result)

      expect(tournament.groups.length).toBe(3)

      for (const group of tournament.groups) {
        expect(group.players.length).toBe(3)
      }
    })
  })
})
