import type { TimeEntry } from '@common/models/timeEntry'
import type { Track } from '@common/models/track'
import { describe, expect, test } from 'bun:test'
import { groupItems } from '../frontend/components/grouped-list/grouping'
import {
  byMedal,
  hasMedalTimes,
} from '../frontend/components/timeentries/timeEntry.groupings'

const track: Track = {
  id: 'medal-track',
  createdAt: new Date('2026-11-01T12:00:00Z'),
  updatedAt: null,
  deletedAt: null,
  level: 'custom',
  mapType: null,
  game: 'next',
  uid: 'medal-track-uid',
  name: 'Medal Track',
  author: null,
  environment: null,
  authorMedalMs: 40_000,
  goldMedalMs: 45_000,
  silverMedalMs: 50_000,
  bronzeMedalMs: 60_000,
  isLaps: false,
  totalLaps: null,
  checkpointsPerLap: null,
}

function entry(
  id: string,
  duration: number | null,
  chugDurationMs: number | null,
  status: TimeEntry['status'] = 'completed'
): TimeEntry {
  return {
    id,
    createdAt: new Date('2026-11-01T12:00:00Z'),
    updatedAt: null,
    deletedAt: null,
    user: null,
    track: track.id,
    session: null,
    webhookCapture: null,
    chugDurationMs,
    duration,
    status,
    tieBreaker: false,
    amount: 0.5,
    comment: null,
  }
}

function summarize(entries: TimeEntry[], medalTrack = track) {
  return groupItems(entries, byMedal(medalTrack)).map(group => ({
    key: group.key,
    label: group.label,
    icon: group.icon,
    ids: group.items.map(item => item.id),
  }))
}

describe('medal grouping', () => {
  test('groups by lap time without chug time, best medal first', () => {
    const entries = [
      entry('silver', 50_000, null),
      entry('authorWithChug', 52_000, 12_000),
      entry('goldOnLimit', 45_000, 0),
      entry('bronze', 70_000, 15_000),
      entry('none', 61_000, 500),
    ]

    expect(summarize(entries)).toEqual([
      {
        key: 'author',
        label: 'Author',
        icon: '/medals/author.svg',
        ids: ['authorWithChug'],
      },
      {
        key: 'gold',
        label: 'Gull',
        icon: '/medals/gold.svg',
        ids: ['goldOnLimit'],
      },
      {
        key: 'silver',
        label: 'Sølv',
        icon: '/medals/silver.svg',
        ids: ['silver'],
      },
      {
        key: 'bronze',
        label: 'Bronse',
        icon: '/medals/bronze.svg',
        ids: ['bronze'],
      },
      { key: 'none', label: 'Ingen medalje', icon: undefined, ids: ['none'] },
    ])
  })

  test('only completed entries with a duration earn medals', () => {
    const entries = [
      entry('draft', 30_000, null, 'draft'),
      entry('cancelled', 30_000, null, 'cancelled'),
      entry('missing', null, null),
    ]

    expect(summarize(entries).map(group => group.key)).toEqual(['none'])
  })

  test('skips unknown medal times', () => {
    const partialTrack: Track = {
      ...track,
      authorMedalMs: 0,
      goldMedalMs: null,
    }

    expect(hasMedalTimes(partialTrack)).toBe(true)
    expect(
      summarize([entry('fast', 30_000, null)], partialTrack).map(g => g.key)
    ).toEqual(['silver'])
    expect(
      hasMedalTimes({
        ...track,
        authorMedalMs: 0,
        goldMedalMs: 0,
        silverMedalMs: null,
        bronzeMedalMs: null,
      })
    ).toBe(false)
  })
})
