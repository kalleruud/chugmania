import type { EntryStatus } from '@common/models/entry'
import { getChugLeaderboard } from '@common/utils/chug'
import { describe, expect, test } from 'bun:test'
import MatchManager from '../backend/src/managers/match.manager'
import TimeEntryManager from '../backend/src/managers/timeEntry.manager'
import { assertResponse, createTracks, createUser, login } from './utils'

async function fetchChugLeaderboard() {
  return getChugLeaderboard(
    await TimeEntryManager.getAllTimeEntries(),
    await MatchManager.getAllMatches()
  )
}

describe('Chug leaderboard', () => {
  test('lists each player once with their best chug, fastest first', async () => {
    const admin = createUser('chug-admin', 'admin', 'chug-admin')
    const socket = await login(admin)
    const [track] = createTracks()
    for (const id of ['chug-a', 'chug-b', 'chug-c', 'chug-none'])
      createUser(id, 'user', id)

    const entries: {
      id: string
      user: string
      chugDurationMs: number | null
      status?: EntryStatus
    }[] = [
      { id: 'chug-a-slow', user: 'chug-a', chugDurationMs: 5200 },
      { id: 'chug-a-fast', user: 'chug-a', chugDurationMs: 3100 },
      { id: 'chug-b-only', user: 'chug-b', chugDurationMs: 4400 },
      { id: 'chug-none-lap', user: 'chug-none', chugDurationMs: null },
      {
        id: 'chug-c-cancelled',
        user: 'chug-c',
        chugDurationMs: 1000,
        status: 'cancelled',
      },
      {
        id: 'chug-b-draft',
        user: 'chug-b',
        chugDurationMs: 900,
        status: 'draft',
      },
    ]
    for (const entry of entries)
      await TimeEntryManager.onPostTimeEntry(socket, {
        type: 'CreateTimeEntryRequest',
        track: track.id,
        duration: entry.status ? null : 60000,
        ...entry,
      }).then(assertResponse)

    await MatchManager.onCreateMatch(socket, {
      type: 'CreateMatchRequest',
      user1: 'chug-c',
      user2: 'chug-b',
      track: track.id,
      status: 'completed',
      winner: 'chug-c',
      user1ChugDurationMs: 2900,
      user2ChugDurationMs: 6000,
    }).then(assertResponse)

    const leaderboard = await fetchChugLeaderboard()
    const players = new Set(['chug-a', 'chug-b', 'chug-c', 'chug-none'])
    expect(leaderboard.filter(chug => players.has(chug.user))).toEqual([
      { user: 'chug-c', durationMs: 2900 },
      { user: 'chug-a', durationMs: 3100 },
      { user: 'chug-b', durationMs: 4400 },
    ])
    const durations = leaderboard.map(chug => chug.durationMs)
    expect(durations).toEqual(durations.toSorted((a, b) => a - b))
  })
})
