import type { EntryStatus } from '@common/models/entry'
import { getChugLeaderboard, type ChugMode } from '@common/utils/chug'
import { describe, expect, test } from 'bun:test'
import MatchManager from '../backend/src/managers/match.manager'
import SessionManager from '../backend/src/managers/session.manager'
import TimeEntryManager from '../backend/src/managers/timeEntry.manager'
import { assertResponse, createTracks, createUser, login } from './utils'

async function fetchChugLeaderboard(mode: ChugMode, players: string[]) {
  const leaderboard = getChugLeaderboard(
    await TimeEntryManager.getAllTimeEntries(),
    await MatchManager.getAllMatches(),
    await SessionManager.getAllSessions(),
    mode
  )
  const durations = leaderboard.map(chug => chug.durationMs)
  expect(durations).toEqual(durations.toSorted((a, b) => a - b))
  return leaderboard.filter(chug => players.includes(chug.user))
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

    expect(
      await fetchChugLeaderboard('best', [
        'chug-a',
        'chug-b',
        'chug-c',
        'chug-none',
      ])
    ).toEqual([
      { user: 'chug-c', durationMs: 2900 },
      { user: 'chug-a', durationMs: 3100 },
      { user: 'chug-b', durationMs: 4400 },
    ])
  })

  test('averages each player over their last 3 sessions with a chug', async () => {
    const admin = createUser('chug-avg-admin', 'admin', 'chug-avg-admin')
    const socket = await login(admin)
    const [track] = createTracks()
    const players = ['chug-avg-a', 'chug-avg-b', 'chug-avg-c']
    for (const id of players) createUser(id, 'user', id)

    const sessionIds = [1, 2, 3, 4].map(day => `chug-avg-session-${day}`)
    for (const [index, id] of sessionIds.entries())
      await SessionManager.onCreateSession(socket, {
        type: 'CreateSessionRequest',
        id,
        name: id,
        date: new Date(Date.UTC(2026, 0, index + 1)),
      }).then(assertResponse)
    const [oldest, second, third, newest] = sessionIds

    const entries: {
      user: string
      chugDurationMs: number
      session: string | null
      status?: EntryStatus
    }[] = [
      { user: 'chug-avg-a', chugDurationMs: 2000, session: oldest },
      { user: 'chug-avg-a', chugDurationMs: 4000, session: second },
      { user: 'chug-avg-a', chugDurationMs: 6000, session: second },
      { user: 'chug-avg-a', chugDurationMs: 5000, session: third },
      { user: 'chug-avg-a', chugDurationMs: 1000, session: null },
      {
        user: 'chug-avg-a',
        chugDurationMs: 100,
        session: newest,
        status: 'draft',
      },
      { user: 'chug-avg-b', chugDurationMs: 2500, session: null },
      { user: 'chug-avg-c', chugDurationMs: 4000, session: oldest },
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
      user1: 'chug-avg-a',
      user2: 'chug-avg-c',
      track: track.id,
      session: newest,
      status: 'completed',
      winner: 'chug-avg-a',
      user1ChugDurationMs: 3000,
      user2ChugDurationMs: null,
    }).then(assertResponse)

    expect(await fetchChugLeaderboard('average', players)).toEqual([
      { user: 'chug-avg-c', durationMs: 4000 },
      { user: 'chug-avg-a', durationMs: 4500 },
    ])
    expect(await fetchChugLeaderboard('best', players)).toEqual([
      { user: 'chug-avg-a', durationMs: 1000 },
      { user: 'chug-avg-b', durationMs: 2500 },
      { user: 'chug-avg-c', durationMs: 4000 },
    ])
  })
})
