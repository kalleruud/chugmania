import type {
  TournamentConfig,
  TournamentDetails,
} from '@common/models/tournament'
import { getTournamentStages } from '@common/utils/tournament'
import { beforeAll, expect, test } from 'bun:test'
import assert from 'node:assert/strict'
import MatchManager from '../backend/src/managers/match.manager'
import TournamentManager from '../backend/src/managers/tournament/tournament.manager'
import type { TypedSocket } from '../backend/src/server'
import {
  assertResponse,
  createRsvps,
  createSession,
  createTracks,
  createUser,
  login,
} from './utils'

async function CreateTournament(options: {
  config: Omit<TournamentConfig, 'session' | 'stageTracks'>
  tracks: number
  users: string[]
}): Promise<{
  socket: TypedSocket
  config: TournamentConfig
  details: TournamentDetails
  preview: TournamentDetails
}> {
  const players = options.users.map((name, index) =>
    createUser(name, index === 0 ? 'admin' : 'user')
  )
  const socket = await login(players[0])
  const tracks = createTracks(options.tracks)
  const session = await createSession(
    socket,
    await createRsvps({ yes: players.length, no: 0, maybe: 0 })
  )

  const config: TournamentConfig = {
    ...options.config,
    session: session.id,
    stageTracks: {},
  }
  for (const stage of getTournamentStages(config, players.length))
    config.stageTracks[stage] = tracks.map(track => track.id)

  const preview = await TournamentManager.onPreview(socket, config)
  assert(preview.success)
  const unsaved = await TournamentManager.onGet(socket, {
    session: config.session,
  })
  assert(unsaved.success)
  expect(unsaved.details).toBeNull()

  const created = await TournamentManager.onCreate(socket, config)
  assert(created.success && created.details)
  return { socket, config, details: created.details, preview: preview.details }
}

let tournament: Awaited<ReturnType<typeof CreateTournament>>

beforeAll(async () => {
  tournament = await CreateTournament({
    config: { groupsCount: 2, advancementCount: 1, eliminationType: 'single' },
    tracks: 1,
    users: ['alice', 'bob', 'charlie', 'daniel'],
  })
})

test('creates and completes a simple tournament through API handlers', async () => {
  const { socket, config, details, preview } = tournament
  expect(preview.groups).toHaveLength(2)
  expect(preview.matches).toHaveLength(3)
  const groupMatches = details.matches.filter(match => match.stage === 'group')
  expect(groupMatches).toHaveLength(2)
  expect(details.groups.map(group => group.standings.length)).toEqual([2, 2])
  const plannedFinal = details.matches.find(match => match.stage === 'final')
  assert(plannedFinal)
  expect([plannedFinal.user1, plannedFinal.user2]).toEqual([null, null])

  const groupWinners: string[] = []
  for (const match of groupMatches) {
    assert(match.user1 && match.user2)
    groupWinners.push(match.user1)
    await MatchManager.onEditMatch(socket, {
      type: 'EditMatchRequest',
      id: match.id,
      status: 'completed',
      winner: match.user1,
    }).then(assertResponse)
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
  await MatchManager.onEditMatch(socket, {
    type: 'EditMatchRequest',
    id: final.id,
    status: 'completed',
    winner: final.user1,
  }).then(assertResponse)
  const finished = await TournamentManager.onGet(socket, {
    session: config.session,
  })
  assert(finished.success && finished.details)
  expect(finished.details.completed).toBe(true)
  expect(finished.details.progress).toMatchObject({ decided: 3, total: 3 })
  expect(finished.details.standings[0]).toEqual({ user: final.user1, rank: 1 })
})
