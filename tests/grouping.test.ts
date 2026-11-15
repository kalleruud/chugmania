import { describe, expect, test } from 'bun:test'
import {
  groupItems,
  limitGroups,
  type Group,
} from '../frontend/components/grouped-list/grouping'
import {
  byMonth,
  byWeek,
  byYear,
} from '../frontend/components/grouped-list/groupings/date'

type Item = { id: string; date: Date | string }

const item = (id: string, date: string): Item => ({ id, date: new Date(date) })
const getDate = (entry: Item) => entry.date

function summarize(groups: ReturnType<typeof groupItems<Item>>) {
  return groups.map(group => ({
    label: group.label,
    ids: group.items.map(entry => entry.id),
  }))
}

describe('groupItems', () => {
  test('keeps item order and only creates groups that have items', () => {
    const items = [
      item('a', '2026-03-01T12:00:00Z'),
      item('b', '2024-06-01T12:00:00Z'),
      item('c', '2026-01-10T12:00:00Z'),
    ]

    expect(summarize(groupItems(items, byYear(getDate)))).toEqual([
      { label: '2026', ids: ['a', 'c'] },
      { label: '2024', ids: ['b'] },
    ])
  })

  test('returns no groups for no items', () => {
    expect(groupItems([], byYear(getDate))).toEqual([])
  })
})

describe('date groupings', () => {
  test('use Oslo time at the new year boundary', () => {
    const items = [item('newYear', '2025-12-31T23:30:00Z')]

    expect(summarize(groupItems(items, byYear(getDate)))).toEqual([
      { label: '2026', ids: ['newYear'] },
    ])
    expect(summarize(groupItems(items, byMonth(getDate)))).toEqual([
      { label: 'januar 2026', ids: ['newYear'] },
    ])
  })

  test('group by ISO week year at the end of December', () => {
    const items = [
      item('monday', '2025-12-29T12:00:00Z'),
      item('sunday', '2025-12-28T12:00:00Z'),
    ]

    expect(summarize(groupItems(items, byWeek(getDate)))).toEqual([
      { label: 'Uke 1, 2026', ids: ['monday'] },
      { label: 'Uke 52, 2025', ids: ['sunday'] },
    ])
  })

  test('accept serialized dates', () => {
    const items: Item[] = [{ id: 'serialized', date: '2025-11-14T12:00:00Z' }]

    expect(summarize(groupItems(items, byMonth(getDate)))).toEqual([
      { label: 'november 2025', ids: ['serialized'] },
    ])
  })
})

describe('limitGroups', () => {
  const group = (key: string, size: number): Group<number> => ({
    key,
    label: key,
    items: Array.from({ length: size }, (_, index) => index),
  })
  const groups = [group('a', 7), group('b', 6), group('c', 2)]

  function summarizeLimits(result: ReturnType<typeof limitGroups<number>>) {
    return {
      groups: result.visibleGroups.map(({ group, shown, canShowMore }) => ({
        key: group.key,
        shown,
        canShowMore,
      })),
      canShowMore: result.canShowMore,
    }
  }

  test('cuts groups at the total limit and hides groups past it', () => {
    const result = limitGroups(groups, {
      groupCounts: {},
      groupLimit: 5,
      totalCount: 8,
    })

    expect(summarizeLimits(result)).toEqual({
      groups: [
        { key: 'a', shown: 5, canShowMore: true },
        { key: 'b', shown: 3, canShowMore: false },
      ],
      canShowMore: true,
    })
  })

  test('only offers the total button when the total limit is used up exactly', () => {
    const result = limitGroups(groups, {
      groupCounts: {},
      groupLimit: 5,
      totalCount: 10,
    })

    expect(summarizeLimits(result)).toEqual({
      groups: [
        { key: 'a', shown: 5, canShowMore: true },
        { key: 'b', shown: 5, canShowMore: false },
      ],
      canShowMore: true,
    })
  })

  test('offers the total button when only group limits hide rows', () => {
    const result = limitGroups([group('a', 15)], {
      groupCounts: {},
      groupLimit: 5,
      totalCount: 5,
    })

    expect(summarizeLimits(result)).toEqual({
      groups: [{ key: 'a', shown: 5, canShowMore: false }],
      canShowMore: true,
    })
  })

  test('shows expanded groups up to the total limit', () => {
    const result = limitGroups(groups, {
      groupCounts: { a: 10 },
      groupLimit: 5,
      totalCount: 20,
    })

    expect(summarizeLimits(result)).toEqual({
      groups: [
        { key: 'a', shown: 7, canShowMore: false },
        { key: 'b', shown: 5, canShowMore: true },
        { key: 'c', shown: 2, canShowMore: false },
      ],
      canShowMore: false,
    })
  })

  test('shows everything without limits', () => {
    const result = limitGroups(groups, { groupCounts: {} })

    expect(result.visibleGroups.map(({ shown }) => shown)).toEqual([7, 6, 2])
    expect(result.canShowMore).toBe(false)
  })
})
