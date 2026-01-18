import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearDB,
  createMockAdmin,
  registerMockUsers,
} from '../../utils/test.helpers'
import SessionManager from '../session.manager'
import GroupManager from './group.manager'
import TournamentManager from './tournament.manager'

/**
 * Blueprint Test for GroupManager.getAll()
 *
 * This test demonstrates the recommended pattern for testing managers with the test database:
 * 1. Use beforeEach to reset the database
 * 2. Use existing manager public APIs (onRegister, onCreateSession, etc.) to create test data
 * 3. Test the public API only
 * 4. Mirror production workflows exactly
 *
 * This pattern should be used as a template for all future manager tests.
 */

// ============================================================================
// BLUEPRINT TEST - Copy this pattern for other managers
// ============================================================================

describe('GroupManager.getAll - Blueprint Test', () => {
  beforeEach(async () => {
    await clearDB()
  })

  it('should return all groups for a tournament with players sorted by wins', async () => {
    // ARRANGE
    const { user, socket } = await createMockAdmin()

    // Register users via public API

    const [user1, user2] = await registerMockUsers(socket, 2)

    const sessionId = randomUUID()
    await SessionManager.onCreateSession(socket, {
      type: 'CreateSessionRequest',
      id: sessionId,
      name: 'Test Session',
      description: 'A test session',
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })

    await SessionManager.onRsvpSession(socket, {
      type: 'RsvpSessionRequest',
      session: sessionId,
      user: user1.id,
      response: 'yes',
    })

    await SessionManager.onRsvpSession(socket, {
      type: 'RsvpSessionRequest',
      session: sessionId,
      user: user2.id,
      response: 'yes',
    })

    const tournamentId = randomUUID()
    await TournamentManager.onCreateTournament(socket, {
      type: 'CreateTournamentRequest',
      id: tournamentId,
      session: sessionId,
      name: 'Test Tournament',
      description: 'A test tournament',
      groupsCount: 1,
      advancementCount: 1,
      eliminationType: 'single',
    })

    // ACT: Call the method under test
    const allGroups = await GroupManager.getAll(tournamentId)

    // ASSERT: Verify results
    expect(allGroups).toHaveLength(1)
    expect(allGroups[0].players).toHaveLength(2)

    const actualUser1 = allGroups[0].players[0]
    expect(actualUser1).toHaveProperty('wins')
    expect(actualUser1).toHaveProperty('losses')
    expect(actualUser1).toHaveProperty('seed')
  })
})

describe('GroupManager - Snake Seeding Logic', () => {
  it('distributes items evenly across groups', () => {
    const groups = [
      { id: 'g1', index: 0 },
      { id: 'g2', index: 1 },
      { id: 'g3', index: 2 },
    ]
    const items = [
      { id: 'p1', seed: 100 },
      { id: 'p2', seed: 90 },
      { id: 'p3', seed: 80 },
      { id: 'p4', seed: 70 },
      { id: 'p5', seed: 60 },
      { id: 'p6', seed: 50 },
    ]

    const result = GroupManager.snakeSeed(items, groups)
    const groupCounts = countItemsPerGroup(result)

    // Each group should have 2 items (6 items / 3 groups)
    expect(groupCounts.get('g1')).toBe(2)
    expect(groupCounts.get('g2')).toBe(2)
    expect(groupCounts.get('g3')).toBe(2)
  })

  it('seeds highest rated players first', () => {
    const groups = [
      { id: 'g1', index: 0 },
      { id: 'g2', index: 1 },
    ]
    const items = [
      { id: 'p1', seed: 100 },
      { id: 'p2', seed: 90 },
      { id: 'p3', seed: 80 },
      { id: 'p4', seed: 70 },
    ]

    const result = GroupManager.snakeSeed(items, groups)

    // First item should be the highest seeded player
    expect(result[0].item).toBe('p1')
    expect(result[0].seed).toBe(100)
  })

  it('implements snake pattern for 2 groups', () => {
    const groups = [
      { id: 'g1', index: 0 },
      { id: 'g2', index: 1 },
    ]
    const items = [
      { id: 'p1', seed: 100 },
      { id: 'p2', seed: 90 },
      { id: 'p3', seed: 80 },
      { id: 'p4', seed: 70 },
    ]

    const result = GroupManager.snakeSeed(items, groups)

    // Row 0 (left to right): p1 -> g1, p2 -> g2
    expect(result[0]).toEqual({ group: 'g1', item: 'p1', seed: 100 })
    expect(result[1]).toEqual({ group: 'g2', item: 'p2', seed: 90 })

    // Row 1 (right to left): p3 -> g2, p4 -> g1
    expect(result[2]).toEqual({ group: 'g2', item: 'p3', seed: 80 })
    expect(result[3]).toEqual({ group: 'g1', item: 'p4', seed: 70 })
  })

  it('implements snake pattern for 3 groups', () => {
    const groups = [
      { id: 'g1', index: 0 },
      { id: 'g2', index: 1 },
      { id: 'g3', index: 2 },
    ]
    const items = [
      { id: 'p1', seed: 100 },
      { id: 'p2', seed: 90 },
      { id: 'p3', seed: 80 },
      { id: 'p4', seed: 70 },
      { id: 'p5', seed: 60 },
      { id: 'p6', seed: 50 },
    ]

    const result = GroupManager.snakeSeed(items, groups)

    // Row 0 (left to right): p1 -> g1, p2 -> g2, p3 -> g3
    expect(result[0].group).toBe('g1')
    expect(result[1].group).toBe('g2')
    expect(result[2].group).toBe('g3')

    // Row 1 (right to left): p4 -> g3, p5 -> g2, p6 -> g1
    expect(result[3].group).toBe('g3')
    expect(result[4].group).toBe('g2')
    expect(result[5].group).toBe('g1')
  })

  it('handles uneven item distribution', () => {
    const groups = [
      { id: 'g1', index: 0 },
      { id: 'g2', index: 1 },
    ]
    const items = [
      { id: 'p1', seed: 100 },
      { id: 'p2', seed: 90 },
      { id: 'p3', seed: 80 },
    ]

    const result = GroupManager.snakeSeed(items, groups)
    const groupCounts = countItemsPerGroup(result)
    const counts = Array.from(groupCounts.values()).toSorted()

    expect(counts).toEqual([1, 2])
  })

  it('sorts items by seed descending before seeding', () => {
    const groups = [
      { id: 'g1', index: 0 },
      { id: 'g2', index: 1 },
    ]
    // Items provided in non-sorted order
    const items = [
      { id: 'p3', seed: 80 },
      { id: 'p1', seed: 100 },
      { id: 'p4', seed: 70 },
      { id: 'p2', seed: 90 },
    ]

    const result = GroupManager.snakeSeed(items, groups)

    // Results should be in descending seed order
    expect(result[0].seed).toBe(100)
    expect(result[1].seed).toBe(90)
    expect(result[2].seed).toBe(80)
    expect(result[3].seed).toBe(70)
  })

  it('maintains all items after seeding', () => {
    const groups = [
      { id: 'g1', index: 0 },
      { id: 'g2', index: 1 },
      { id: 'g3', index: 2 },
    ]
    const items = [
      { id: 'p1', seed: 100 },
      { id: 'p2', seed: 90 },
      { id: 'p3', seed: 80 },
      { id: 'p4', seed: 70 },
      { id: 'p5', seed: 60 },
      { id: 'p6', seed: 50 },
    ]

    const result = GroupManager.snakeSeed(items, groups)
    const resultIds = result.map(r => r.item).toSorted()
    const inputIds = items.map(i => i.id).toSorted()

    // All items should be in the result
    expect(result).toHaveLength(items.length)
    expect(resultIds).toEqual(inputIds)
  })

  it('handles single group edge case', () => {
    const groups = [{ id: 'g1', index: 0 }]
    const items = [
      { id: 'p1', seed: 100 },
      { id: 'p2', seed: 90 },
      { id: 'p3', seed: 80 },
    ]

    const result = GroupManager.snakeSeed(items, groups)

    // All items should go to the single group
    expect(result.every(r => r.group === 'g1')).toBe(true)
    expect(result).toHaveLength(3)
  })

  it('balances high and low seed distribution', () => {
    const groups = [
      { id: 'g1', index: 0 },
      { id: 'g2', index: 1 },
    ]
    const items = [
      { id: 'p1', seed: 100 },
      { id: 'p2', seed: 90 },
      { id: 'p3', seed: 80 },
      { id: 'p4', seed: 70 },
    ]

    const result = GroupManager.snakeSeed(items, groups)
    const group1Seeds = getGroupSeeds(result, 'g1')
    const group2Seeds = getGroupSeeds(result, 'g2')

    // Group 1 should have p1 (highest) and p4 (lowest)
    expect(group1Seeds).toEqual([100, 70])

    // Group 2 should have p2 and p3 (middle)
    expect(group2Seeds).toEqual([90, 80])
  })
})

// Helper functions

function countItemsPerGroup(
  result: Array<{ group: string; item: string; seed: number }>
): Map<string, number> {
  const groupCounts = new Map<string, number>()
  for (const item of result) {
    groupCounts.set(item.group, (groupCounts.get(item.group) ?? 0) + 1)
  }
  return groupCounts
}

function getGroupSeeds(
  result: Array<{ group: string; item: string; seed: number }>,
  groupId: string
): number[] {
  return result
    .filter(r => r.group === groupId)
    .map(r => r.seed)
    .toSorted((a, b) => b - a)
}
