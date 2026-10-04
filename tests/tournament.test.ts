import type { TournamentConfig } from '@common/models/tournament'
import { expect, test } from 'bun:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  sessions,
  sessionSignups,
  tracks,
  users,
} from '../backend/database/schema'
import AuthManager from '../backend/src/managers/auth.manager'
import MatchManager from '../backend/src/managers/match.manager'
import TournamentManager from '../backend/src/managers/tournament/tournament.manager'
import { createSocket, db } from './setup'

test('creates and completes a simple tournament through API handlers', async () => {
  const playerIds = ['alice', 'bob', 'charlie', 'daniel']
  const passwordHash = createHash('sha512').update('test-password').digest()
  for (const [index, id] of playerIds.entries())
    db.insert(users)
      .values({
        id,
        email: `${id}@example.test`,
        firstName: id,
        role: index === 0 ? 'admin' : 'user',
        passwordHash,
      })
      .run()
  db.insert(tracks)
    .values({ id: 'track', number: 1, level: 'white', type: 'stadium' })
    .run()
  db.insert(sessions)
    .values({ id: 'session', name: 'Test Cup', date: new Date(0) })
    .run()
  for (const user of playerIds)
    db.insert(sessionSignups)
      .values({ session: 'session', user, response: 'yes' })
      .run()

  const socket = createSocket()
  const login = await AuthManager.onLogin(socket, {
    type: 'LoginRequest',
    email: 'alice@example.test',
    password: 'test-password',
  })
  assert(login.success)
  socket.handshake.auth.token = login.token

  const config: TournamentConfig = {
    session: 'session',
    groupsCount: 2,
    advancementCount: 1,
    eliminationType: 'single',
    stageTracks: { group: ['track'], final: ['track'] },
  }
  const preview = await TournamentManager.onPreview(socket, config)
  assert(preview.success)
  expect(preview.details.groups).toHaveLength(2)
  expect(preview.details.matches).toHaveLength(3)
  const unsaved = await TournamentManager.onGet(socket, {
    session: config.session,
  })
  assert(unsaved.success)
  expect(unsaved.details).toBeNull()

  const created = await TournamentManager.onCreate(socket, config)
  assert(created.success && created.details)
  const groupMatches = created.details.matches.filter(
    match => match.stage === 'group'
  )
  expect(groupMatches).toHaveLength(2)
  expect(created.details.groups.map(group => group.standings.length)).toEqual([
    2, 2,
  ])
  const plannedFinal = created.details.matches.find(
    match => match.stage === 'final'
  )
  assert(plannedFinal)
  expect([plannedFinal.user1, plannedFinal.user2]).toEqual([null, null])

  const groupWinners: string[] = []
  for (const match of groupMatches) {
    assert(match.user1 && match.user2)
    groupWinners.push(match.user1)
    const response = await MatchManager.onEditMatch(socket, {
      type: 'EditMatchRequest',
      id: match.id,
      status: 'completed',
      winner: match.user1,
    })
    assert(response.success)
  }
  const progressed = await TournamentManager.onGet(socket, {
    session: config.session,
  })
  assert(progressed.success && progressed.details)
  const final = progressed.details.matches.find(
    match => match.stage === 'final'
  )
  assert(final && final.user1 && final.user2)
  expect([final.user1, final.user2].toSorted()).toEqual(groupWinners.toSorted())
  const result = await MatchManager.onEditMatch(socket, {
    type: 'EditMatchRequest',
    id: final.id,
    status: 'completed',
    winner: final.user1,
  })
  assert(result.success)
  const finished = await TournamentManager.onGet(socket, {
    session: config.session,
  })
  assert(finished.success && finished.details)
  expect(finished.details.completed).toBe(true)
  expect(finished.details.progress).toMatchObject({ decided: 3, total: 3 })
  expect(finished.details.standings[0]).toEqual({ user: final.user1, rank: 1 })
})
