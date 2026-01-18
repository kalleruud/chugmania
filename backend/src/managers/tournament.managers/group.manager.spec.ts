import { describe, expect, it } from 'vitest'
import GroupManager from './group.manager'

/**
 * Tests for pure functions in GroupManager
 *
 * Snake seeding pattern:
 * Row 0: A B C D (left to right)
 * Row 1: D C B A (right to left)
 * Row 2: A B C D (left to right)
 * etc.
 */

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

    // Count items per group
    const groupCounts = new Map<string, number>()
    for (const item of result) {
      groupCounts.set(item.group, (groupCounts.get(item.group) ?? 0) + 1)
    }

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

    // Should distribute 2 to one group, 1 to another
    const groupCounts = new Map<string, number>()
    for (const item of result) {
      groupCounts.set(item.group, (groupCounts.get(item.group) ?? 0) + 1)
    }

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

    // All items should be in the result
    expect(result).toHaveLength(items.length)

    const resultIds = result.map(r => r.item).toSorted()
    const inputIds = items.map(i => i.id).toSorted()
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

    // Group 1 should have p1 (highest) and p4 (lowest)
    const group1 = result.filter(r => r.group === 'g1')
    expect(group1.map(r => r.seed).toSorted((a, b) => b - a)).toEqual([100, 70])

    // Group 2 should have p2 and p3 (middle)
    const group2 = result.filter(r => r.group === 'g2')
    expect(group2.map(r => r.seed).toSorted((a, b) => b - a)).toEqual([90, 80])
  })
})
