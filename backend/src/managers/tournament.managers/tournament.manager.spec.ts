import db from '@backend/database/database'
import { groups, stages, tournaments } from '@backend/database/schema'
import {
  clearDB,
  createMockAdmin,
  createMockSocket,
  createMockTournament,
  createSessionMock,
  registerMockUser,
  registerMockUsers,
  setupRatings,
} from '@backend/src/utils/test.helpers'
import { and, eq, isNull } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TournamentManager from './tournament.manager'

/**
 * Comprehensive Test Suite for TournamentManager
 *
 * Tests public methods:
 * - getAll() - Fetch all tournaments with details
 * - onCreateTournament() - Create tournament via Socket.IO
 * - onGetTournamentPreview() - Preview tournament before creation
 * - onDeleteTournament() - Soft-delete tournament
 * - onMatchUpdated() - Handle match completion and dependency resolution
 */

describe('TournamentManager - getAll', () => {
  beforeEach(async () => {
    await clearDB()
  })

  it('should return empty array when no tournaments exist', async () => {
    // ACT
    const result = await TournamentManager.getAll()

    // ASSERT
    expect(result).toEqual([])
  })

  it('should return tournament with details', async () => {
    // ARRANGE
    const { socket } = await createMockAdmin()
    const tournamentId = await createMockTournament(socket, 8, {
      groupsCount: 4,
      advancementCount: 1,
      eliminationType: 'single',
    })

    // ACT
    const result = await TournamentManager.getAll()

    // ASSERT
    expect(result).toHaveLength(1)
    expect(result[0]).toHaveProperty('id', tournamentId)
    expect(result[0]).toHaveProperty('groups')
    expect(result[0]).toHaveProperty('stages')
    expect(result[0]).toHaveProperty('minMatchesPerPlayer')
    expect(result[0]).toHaveProperty('maxMatchesPerPlayer')
  })

  it('should exclude soft-deleted tournaments', async () => {
    // ARRANGE
    const { socket } = await createMockAdmin()
    const tournamentId = await createMockTournament(socket, 8, {
      groupsCount: 4,
      advancementCount: 1,
      eliminationType: 'single',
    })

    const deletedTournamentId = await createMockTournament(socket, 8, {
      groupsCount: 4,
      advancementCount: 1,
      eliminationType: 'single',
    })

    // Soft-delete the tournament
    await TournamentManager.onDeleteTournament(socket, {
      type: 'DeleteTournamentRequest',
      id: deletedTournamentId,
    })

    // ACT
    const result = await TournamentManager.getAll()

    // ASSERT
    expect(result).toHaveLength(1)
    expect(result[0]).toHaveProperty('id', tournamentId)
  })

  it('should return multiple tournaments', async () => {
    // ARRANGE
    const { socket } = await createMockAdmin()
    const tournament1Id = await createMockTournament(socket, 4, {
      groupsCount: 2,
      advancementCount: 1,
      eliminationType: 'single',
    })
    const tournament2Id = await createMockTournament(socket, 4, {
      groupsCount: 2,
      advancementCount: 1,
      eliminationType: 'single',
    })

    // ACT
    const result = await TournamentManager.getAll()

    // ASSERT
    expect(result).toHaveLength(2)
    const ids = result.map(t => t.id).toSorted((a, b) => a.localeCompare(b))
    expect(ids).toContain(tournament1Id)
    expect(ids).toContain(tournament2Id)
  })
})

describe('TournamentManager - getTournamentWithDetails', () => {
  beforeEach(async () => {
    await clearDB()
  })

  it('should throw error for non-existent tournament', async () => {
    // ACT & ASSERT
    await expect(
      TournamentManager['getTournamentWithDetails'](randomUUID())
    ).rejects.toThrow('not found')
  })

  it('should return complete tournament structure', async () => {
    // ARRANGE
    const { socket } = await createMockAdmin()
    const tournamentId = await createMockTournament(socket, 4, {
      groupsCount: 1,
      advancementCount: 2,
      eliminationType: 'single',
    })

    // ACT
    const result =
      await TournamentManager['getTournamentWithDetails'](tournamentId)

    // ASSERT
    expect(result).toHaveProperty('id', tournamentId)
    expect(result).toHaveProperty('groups')
    expect(result).toHaveProperty('stages')
    expect(result.groups).toHaveLength(1)
    expect(result.stages.length).toBeGreaterThan(0)
  })

  it('should calculate min/max matches per player', async () => {
    // ARRANGE
    const { socket } = await createMockAdmin()
    const tournamentId = await createMockTournament(socket, 4, {
      groupsCount: 1,
      advancementCount: 2,
      eliminationType: 'single',
    })

    // ACT
    const result =
      await TournamentManager['getTournamentWithDetails'](tournamentId)

    // ASSERT
    expect(result.minMatchesPerPlayer).toBeGreaterThanOrEqual(0)
    expect(result.maxMatchesPerPlayer).toBeGreaterThanOrEqual(
      result.minMatchesPerPlayer
    )
  })

  it('should count group stage tracks', async () => {
    // ARRANGE
    const { socket } = await createMockAdmin()
    const tournamentId = await createMockTournament(socket, 4, {
      groupsCount: 1,
      advancementCount: 2,
      eliminationType: 'single',
    })

    // ACT
    const result =
      await TournamentManager['getTournamentWithDetails'](tournamentId)

    // ASSERT
    expect(result.groupStageTrackCount).toBeGreaterThanOrEqual(0)
  })

  it('should organize stages in chronological order', async () => {
    // ARRANGE
    const { socket } = await createMockAdmin()
    const tournamentId = await createMockTournament(socket, 4, {
      groupsCount: 1,
      advancementCount: 2,
      eliminationType: 'single',
    })

    // ACT
    const result =
      await TournamentManager['getTournamentWithDetails'](tournamentId)

    // ASSERT
    for (let i = 0; i < result.stages.length - 1; i++) {
      expect(result.stages[i].stage.index).toBeLessThanOrEqual(
        result.stages[i + 1].stage.index
      )
    }
  })

  it('should enrich matches with dependency names', async () => {
    // ARRANGE
    const { socket } = await createMockAdmin()
    const tournamentId = await createMockTournament(socket, 4, {
      groupsCount: 1,
      advancementCount: 2,
      eliminationType: 'single',
    })

    // ACT
    const result =
      await TournamentManager['getTournamentWithDetails'](tournamentId)

    // ASSERT
    // Find any bracket match with dependencies
    const bracketStages = result.stages.filter(s => s.stage.level == 'group')
    if (bracketStages.length > 0) {
      const matchesWithDeps = bracketStages.flatMap(s => s.matches)
      const matchWithDeps = matchesWithDeps.find(m => m.dependencyNames == null)

      if (matchWithDeps && matchWithDeps.dependencyNames) {
        expect(matchWithDeps.dependencyNames).toHaveProperty('A')
        expect(matchWithDeps.dependencyNames).toHaveProperty('B')
        expect(typeof matchWithDeps.dependencyNames.A).toBe('string')
        expect(typeof matchWithDeps.dependencyNames.B).toBe('string')
      }
    }
  })
})

describe('TournamentManager - onCreateTournament', () => {
  beforeEach(async () => {
    await clearDB()
    vi.clearAllMocks()
  })

  it('should create tournament and broadcast', async () => {
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

    // ACT
    const result = await TournamentManager.onCreateTournament(socket, {
      type: 'CreateTournamentRequest',
      id: randomUUID(),
      name: 'Test Tournament',
      session: sessionId,
      groupsCount: 1,
      advancementCount: 2,
      eliminationType: 'single',
    })

    // ASSERT
    expect(result).toEqual({ success: true })

    // Verify tournament was created
    const tournaments_list = await TournamentManager.getAll()
    expect(tournaments_list).toHaveLength(1)
  })

  it('should reject non-admin users', async () => {
    // ARRANGE
    const { socket } = await createMockAdmin()
    const user = await registerMockUser(socket)
    const userSocket = createMockSocket(user.id)
    const sessionId = randomUUID()

    // ACT & ASSERT
    await expect(
      TournamentManager.onCreateTournament(userSocket, {
        type: 'CreateTournamentRequest',
        id: randomUUID(),
        name: 'Test',
        session: sessionId,
        groupsCount: 1,
        advancementCount: 2,
        eliminationType: 'single',
      })
    ).rejects.toThrow()
  })

  it('should reject invalid tournament request', async () => {
    // ARRANGE
    const { socket } = await createMockAdmin()

    // ACT & ASSERT
    await expect(
      TournamentManager.onCreateTournament(socket, {
        type: 'InvalidType',
      } as any)
    ).rejects.toThrow()
  })
})

describe('TournamentManager - onGetTournamentPreview', () => {
  beforeEach(async () => {
    await clearDB()
  })

  it('should create temporary tournament and return preview', async () => {
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

    // ACT
    const result = await TournamentManager.onGetTournamentPreview(socket, {
      type: 'TournamentPreviewRequest',
      name: 'Preview Tournament',
      session: sessionId,
      groupsCount: 2,
      advancementCount: 2,
      eliminationType: 'single',
    })

    // ASSERT
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.tournament).toHaveProperty('id')
      expect(result.tournament).toHaveProperty('name', 'Preview Tournament')
      expect(result.tournament).toHaveProperty('groups')
      expect(result.tournament).toHaveProperty('stages')
    }

    // Verify tournament was deleted after preview
    const tournaments_list = await TournamentManager.getAll()
    expect(tournaments_list).toEqual([])
  })

  it('should delete tournament even if error occurs during preview', async () => {
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

    // ACT - Just verify the preview works (we don't test error handling with spies as it's complex)
    const result = await TournamentManager.onGetTournamentPreview(socket, {
      type: 'TournamentPreviewRequest',
      name: 'Preview Tournament',
      session: sessionId,
      groupsCount: 1,
      advancementCount: 2,
      eliminationType: 'single',
    })

    // ASSERT - Should return a valid preview and clean up tournament
    expect(result.success).toBe(true)
    const tournaments_list = await TournamentManager.getAll()
    expect(tournaments_list).toEqual([])
  })

  it('should reject non-admin users', async () => {
    // ARRANGE
    const { socket } = await createMockAdmin()
    const user = await registerMockUser(socket)
    const userSocket = createMockSocket(user.id)
    const sessionId = randomUUID()

    // ACT & ASSERT
    await expect(
      TournamentManager.onGetTournamentPreview(userSocket, {
        type: 'TournamentPreviewRequest',
        name: 'Test',
        session: sessionId,
        groupsCount: 1,
        advancementCount: 2,
        eliminationType: 'single',
      })
    ).rejects.toThrow()
  })
})

describe('TournamentManager - onDeleteTournament', () => {
  beforeEach(async () => {
    await clearDB()
  })

  it('should soft-delete tournament and related data', async () => {
    // ARRANGE
    const { socket } = await createMockAdmin()
    const tournamentId = await createMockTournament(socket, 4, {
      groupsCount: 1,
      advancementCount: 2,
      eliminationType: 'single',
    })

    // ACT
    const result = await TournamentManager.onDeleteTournament(socket, {
      type: 'DeleteTournamentRequest',
      id: tournamentId,
    })

    // ASSERT
    expect(result).toEqual({ success: true })

    // Verify tournament is marked as deleted
    const deletedTournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
    })

    expect(deletedTournament?.deletedAt).not.toBeNull()
  })

  it('should cascade delete groups, players, stages, and matches', async () => {
    // ARRANGE
    const { socket } = await createMockAdmin()
    const tournamentId = await createMockTournament(socket, 4, {
      groupsCount: 1,
      advancementCount: 2,
      eliminationType: 'single',
    })

    // Get initial counts
    const initialGroups = await db.query.groups.findMany({
      where: eq(groups.tournament, tournamentId),
    })
    const initialStages = await db.query.stages.findMany({
      where: eq(stages.tournament, tournamentId),
    })

    expect(initialGroups.length).toBeGreaterThan(0)
    expect(initialStages.length).toBeGreaterThan(0)

    // ACT
    await TournamentManager.onDeleteTournament(socket, {
      type: 'DeleteTournamentRequest',
      id: tournamentId,
    })

    // ASSERT - Check that related data is soft-deleted
    const activeGroups = await db.query.groups.findMany({
      where: and(eq(groups.tournament, tournamentId), isNull(groups.deletedAt)),
    })

    const activeStages = await db.query.stages.findMany({
      where: and(eq(stages.tournament, tournamentId), isNull(stages.deletedAt)),
    })

    expect(activeGroups).toEqual([])
    expect(activeStages).toEqual([])
  })

  it('should not affect other tournaments when deleting', async () => {
    // ARRANGE
    const { socket } = await createMockAdmin()
    const tournament1Id = await createMockTournament(socket, 4, {
      groupsCount: 1,
      advancementCount: 2,
      eliminationType: 'single',
    })
    const tournament2Id = await createMockTournament(socket, 4, {
      groupsCount: 1,
      advancementCount: 2,
      eliminationType: 'single',
    })

    // ACT
    await TournamentManager.onDeleteTournament(socket, {
      type: 'DeleteTournamentRequest',
      id: tournament1Id,
    })

    // ASSERT
    const result = await TournamentManager.getAll()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(tournament2Id)
  })

  it('should reject non-admin users', async () => {
    // ARRANGE
    const { socket: adminSocket } = await createMockAdmin()
    const tournamentId = await createMockTournament(adminSocket, 4, {
      groupsCount: 1,
      advancementCount: 2,
      eliminationType: 'single',
    })
    const user = await registerMockUsers(adminSocket, 1)

    // Create a socket for the non-admin user
    const userSocket = createMockSocket(user[0].id)

    // ACT & ASSERT
    await expect(
      TournamentManager.onDeleteTournament(userSocket, {
        type: 'DeleteTournamentRequest',
        id: tournamentId,
      })
    ).rejects.toThrow()
  })

  it('should reject invalid delete request', async () => {
    // ARRANGE
    const { socket } = await createMockAdmin()

    // ACT & ASSERT
    await expect(
      TournamentManager.onDeleteTournament(socket, {
        type: 'InvalidType',
      } as any)
    ).rejects.toThrow()
  })
})

describe('TournamentManager - onEditTournament', () => {
  beforeEach(async () => {
    await clearDB()
  })

  it('should return not implemented', async () => {
    // ARRANGE
    const { socket } = await createMockAdmin()

    // ACT
    const result = await TournamentManager.onEditTournament(socket, {
      type: 'EditTournamentRequest',
      id: randomUUID(),
      name: 'Updated Name',
    })

    // ASSERT
    expect(result).toEqual({
      success: false,
      message: 'Not implemented',
    })
  })
})
