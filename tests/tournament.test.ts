import type { Match } from '@common/models/match'
import type {
  TournamentConfig,
  TournamentDetails,
} from '@common/models/tournament'
import { getTournamentStages } from '@common/utils/tournament'
import { describe, expect, test } from 'bun:test'
import assert from 'node:assert/strict'
import type { MatchStage } from '../backend/database/schema'
import MatchManager from '../backend/src/managers/match.manager'
import SessionManager from '../backend/src/managers/session.manager'
import TournamentManager from '../backend/src/managers/tournament/tournament.manager'
import {
  assertResponse,
  createRsvps,
  createSession,
  createTracks,
  createUser,
  login,
} from './utils'

type TestMatch = {
  stage: MatchStage | null
  user1: string | null
  user2: string | null
  winner: string | null
  status: Match['status']
  track: number | null
  setWinner(name: string): Promise<void>
}

async function CreateTournament(options: {
  config: Omit<TournamentConfig, 'session' | 'stageTracks'>
  tracks: number
  users: string[]
}) {
  const players = options.users.map((name, index) =>
    createUser(name, index === 0 ? 'admin' : 'user', name)
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
  assertResponse(preview)
  const unsaved = await TournamentManager.onGet(socket, { session: session.id })
  assertResponse(unsaved)
  assert.equal(unsaved.details, null, 'Preview must not persist a tournament')
  assertResponse(await TournamentManager.onCreate(socket, config))
  await assert.rejects(
    SessionManager.onCreateSession(socket, {
      type: 'CreateSessionRequest',
      id: session.id,
      name: 'Duplicate Cup',
      date: new Date(0),
    })
  )
  assert.equal((await SessionManager.getSession(session.id))?.name, 'Test Cup')

  async function getDetails(): Promise<TournamentDetails> {
    const response = await TournamentManager.onGet(socket, {
      session: session.id,
    })
    assertResponse(response)
    assert(response.details)
    return response.details
  }

  async function getMatches(stage: MatchStage): Promise<TestMatch[]> {
    const details = await getDetails()
    return details.matches
      .filter(match => match.stage === stage)
      .map(match => ({
        stage: match.stage,
        user1: match.user1,
        user2: match.user2,
        winner: match.winner,
        status: match.status,
        track: tracks.find(track => track.id === match.track)?.number ?? null,
        async setWinner(name: string): Promise<void> {
          await MatchManager.onEditMatch(socket, {
            type: 'EditMatchRequest',
            id: match.id,
            status: 'completed',
            winner: name,
          }).then(assertResponse)
        },
      }))
  }

  async function getMatch(stage: MatchStage): Promise<TestMatch> {
    const matches = await getMatches(stage)
    assert.equal(matches.length, 1, `Expected one ${stage} match`)
    return matches[0]
  }

  return {
    getMatches,
    getMatch,
    getState: getDetails,
  }
}

async function setWinners(
  matches: TestMatch[],
  names: string[]
): Promise<void> {
  assert.equal(matches.length, names.length, 'Provide one winner per match')
  for (const [index, match] of matches.entries())
    await match.setWinner(names[index])
}

describe('Complete simple tournament', () => {
  let tournament: Awaited<ReturnType<typeof CreateTournament>>

  test.serial('Create tournament', async () => {
    // Arrange
    const config: Parameters<typeof CreateTournament>[0] = {
      config: {
        groupsCount: 4,
        advancementCount: 1,
        eliminationType: 'single',
      },
      tracks: 1,
      users: [
        'alice',
        'bob',
        'charlie',
        'daniel',
        'erin',
        'frank',
        'grace',
        'hugo',
      ],
    }
    const planned = { status: 'planned', winner: null, track: 1 }
    const unresolved = { ...planned, user1: null, user2: null }

    // Act
    tournament = await CreateTournament(config)

    // Assert
    expect(await tournament.getState()).toMatchObject({
      config: config.config,
      completed: false,
      progress: { decided: 0, total: 7, groupDecided: 0, groupTotal: 4 },
    })
    expect(await tournament.getMatches('group')).toMatchObject([
      { ...planned, user1: 'alice', user2: 'hugo' },
      { ...planned, user1: 'bob', user2: 'grace' },
      { ...planned, user1: 'charlie', user2: 'frank' },
      { ...planned, user1: 'daniel', user2: 'erin' },
    ])
    expect(await tournament.getMatches('semi')).toMatchObject([
      unresolved,
      unresolved,
    ])
    expect(await tournament.getMatch('final')).toMatchObject(unresolved)
  })

  test.serial('Complete group stage', async () => {
    // Arrange
    const matches = await tournament.getMatches('group')

    // Act
    await setWinners(matches, ['alice', 'bob', 'charlie', 'daniel'])

    // Assert
    expect(await tournament.getMatches('group')).toMatchObject([
      { winner: 'alice', status: 'completed' },
      { winner: 'bob', status: 'completed' },
      { winner: 'charlie', status: 'completed' },
      { winner: 'daniel', status: 'completed' },
    ])
    expect(await tournament.getMatches('semi')).toMatchObject([
      { user1: 'alice', user2: 'daniel', status: 'planned' },
      { user1: 'bob', user2: 'charlie', status: 'planned' },
    ])
    expect(await tournament.getMatch('final')).toMatchObject({
      user1: null,
      user2: null,
      status: 'planned',
    })
    expect(await tournament.getState()).toMatchObject({
      completed: false,
      progress: { decided: 4 },
    })
  })

  test.serial('Complete semifinals', async () => {
    // Arrange
    const matches = await tournament.getMatches('semi')

    // Act
    await setWinners(matches, ['alice', 'bob'])

    // Assert
    expect(await tournament.getMatches('semi')).toMatchObject([
      { winner: 'alice', status: 'completed' },
      { winner: 'bob', status: 'completed' },
    ])
    expect(await tournament.getMatch('final')).toMatchObject({
      user1: 'alice',
      user2: 'bob',
      status: 'planned',
    })
    expect(await tournament.getState()).toMatchObject({
      completed: false,
      progress: { decided: 6 },
    })
  })

  test.serial('Complete final', async () => {
    // Arrange
    const final = await tournament.getMatch('final')

    // Act
    await final.setWinner('alice')

    // Assert
    expect(await tournament.getMatch('final')).toMatchObject({
      winner: 'alice',
      status: 'completed',
    })
  })

  test.serial('Verify final result and tournament state', async () => {
    // Arrange
    const expected = {
      completed: true,
      frozen: true,
      cancelled: false,
      notReadyReason: null,
      progress: { decided: 7, total: 7, groupDecided: 4, groupTotal: 4 },
      standings: [
        { user: 'alice', rank: 1 },
        { user: 'bob', rank: 2 },
        { user: 'charlie', rank: 3 },
        { user: 'daniel', rank: 3 },
        { user: 'erin', rank: 5 },
        { user: 'frank', rank: 5 },
        { user: 'grace', rank: 5 },
        { user: 'hugo', rank: 5 },
      ],
    }

    // Act
    const state = await tournament.getState()

    // Assert
    expect(state).toMatchObject(expected)
  })
})
