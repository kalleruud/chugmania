import { describe, expect, test } from 'bun:test'
import { groupItems } from '../frontend/components/grouped-list/grouping'
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
