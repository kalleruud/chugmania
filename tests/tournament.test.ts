import type { Match } from '@common/models/match'
import type {
  TournamentConfig,
  TournamentDetails,
} from '@common/models/tournament'
import { getTournamentStages } from '@common/utils/tournament'
import { describe, expect, test } from 'bun:test'
import assert from 'node:assert/strict'
import MatchManager from '../backend/src/managers/match.manager'
import SessionManager from '../backend/src/managers/session.manager'
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
  assert.equal(unsaved.details, null, 'Preview must not persist a tournament')

  const created = await TournamentManager.onCreate(socket, config)
  assert(created.success && created.details)
  return { socket, config, details: created.details, preview: preview.details }
}

describe('Complete simple tournament', () => {
  let tournament: Awaited<ReturnType<typeof CreateTournament>>
  let semifinalLosers: string[]
  let champion: string
  let runnerUp: string

  async function getTournament(): Promise<TournamentDetails> {
    const response = await TournamentManager.onGet(tournament.socket, {
      session: tournament.config.session,
    })
    assertResponse(response)
    assert(response.details)
    return response.details
  }

  async function completeMatches(matches: Match[]): Promise<string[]> {
    const winners: string[] = []
    for (const match of matches) {
      assert(match.user1 && match.user2)
      winners.push(match.user1)
      await MatchManager.onEditMatch(tournament.socket, {
        type: 'EditMatchRequest',
        id: match.id,
        status: 'completed',
        winner: match.user1,
      }).then(assertResponse)
    }
    return winners
  }

  test.serial('Create tournament', async () => {
    // Arrange
    const options: Parameters<typeof CreateTournament>[0] = {
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

    // Act
    tournament = await CreateTournament(options)
    const { socket, config, details, preview } = tournament
    const duplicateSession = SessionManager.onCreateSession(socket, {
      type: 'CreateSessionRequest',
      id: config.session,
      name: 'Duplicate Cup',
      date: new Date(0),
    })

    // Assert
    expect(details.config).toEqual(config)
    expect(details.config).toMatchObject(options.config)
    expect(preview.groups).toHaveLength(4)
    expect(preview.matches).toHaveLength(7)
    expect(details.groups.map(group => group.standings.length)).toEqual([
      2, 2, 2, 2,
    ])
    expect(
      details.matches.filter(match => match.stage === 'group')
    ).toHaveLength(4)
    expect(
      details.matches.filter(match => match.stage === 'semi')
    ).toHaveLength(2)
    expect(
      details.matches.filter(match => match.stage === 'final')
    ).toHaveLength(1)
    expect(details.matches.every(match => match.status === 'planned')).toBe(
      true
    )
    expect(
      details.matches.every(
        match => match.track === config.stageTracks.group?.[0]
      )
    ).toBe(true)
    expect(
      details.matches
        .filter(match => match.stage !== 'group')
        .map(match => [match.user1, match.user2])
    ).toEqual([
      [null, null],
      [null, null],
      [null, null],
    ])
    expect(details.completed).toBe(false)
    expect(details.progress).toEqual({
      decided: 0,
      total: 7,
      groupDecided: 0,
      groupTotal: 4,
    })
    await assert.rejects(duplicateSession)
    expect((await SessionManager.getSession(config.session))?.name).toBe(
      'Test Cup'
    )
  })

  test.serial('Complete group stage', async () => {
    // Arrange
    const before = await getTournament()
    const matches = before.matches.filter(match => match.stage === 'group')

    // Act
    const winners = await completeMatches(matches)
    const after = await getTournament()
    const semifinals = after.matches.filter(match => match.stage === 'semi')

    // Assert
    expect(
      after.matches
        .filter(match => match.stage === 'group')
        .every(match => match.status === 'completed')
    ).toBe(true)
    expect(
      semifinals.flatMap(match => [match.user1, match.user2]).toSorted()
    ).toEqual(winners.toSorted())
    expect(
      after.groups
        .flatMap(group =>
          group.standings
            .filter(player => player.qualifies)
            .map(player => player.user)
        )
        .toSorted()
    ).toEqual(winners.toSorted())
    expect(semifinals.every(match => match.status === 'planned')).toBe(true)
    expect(after.matches.find(match => match.stage === 'final')).toMatchObject({
      user1: null,
      user2: null,
      status: 'planned',
    })
    expect(after.progress).toEqual({
      decided: 4,
      total: 7,
      groupDecided: 4,
      groupTotal: 4,
    })
    expect(after.completed).toBe(false)
  })

  test.serial('Complete semifinals', async () => {
    // Arrange
    const before = await getTournament()
    const matches = before.matches.filter(match => match.stage === 'semi')
    semifinalLosers = matches.map(match => {
      assert(match.user2)
      return match.user2
    })

    // Act
    const winners = await completeMatches(matches)
    const after = await getTournament()
    const final = after.matches.find(match => match.stage === 'final')
    assert(final)

    // Assert
    expect(
      after.matches
        .filter(match => match.stage === 'semi')
        .every(match => match.status === 'completed')
    ).toBe(true)
    expect([final.user1, final.user2].toSorted()).toEqual(winners.toSorted())
    expect(final.status).toBe('planned')
    expect(after.progress.decided).toBe(6)
    expect(after.completed).toBe(false)
  })

  test.serial('Complete final', async () => {
    // Arrange
    const before = await getTournament()
    const final = before.matches.find(match => match.stage === 'final')
    assert(final && final.user1 && final.user2)
    champion = final.user1
    runnerUp = final.user2

    // Act
    await completeMatches([final])
    const after = await getTournament()

    // Assert
    expect(after.matches.find(match => match.id === final.id)).toMatchObject({
      status: 'completed',
      winner: champion,
    })
    expect(after.matches.filter(match => match.status === 'planned')).toEqual(
      []
    )
    expect(after.completed).toBe(true)
  })

  test.serial('Verify final result and tournament state', async () => {
    // Arrange
    const groupLosers = tournament.details.matches
      .filter(match => match.stage === 'group')
      .map(match => {
        assert(match.user2)
        return match.user2
      })
    const expected = [
      { user: champion, rank: 1 },
      { user: runnerUp, rank: 2 },
      ...semifinalLosers.map(user => ({ user, rank: 3 })),
      ...groupLosers.map(user => ({ user, rank: 5 })),
    ]

    // Act
    const finished = await getTournament()

    // Assert
    expect(finished.standings).toHaveLength(8)
    for (const row of expected)
      expect(
        finished.standings.find(standing => standing.user === row.user)
      ).toEqual(row)
    expect(finished.progress).toEqual({
      decided: 7,
      total: 7,
      groupDecided: 4,
      groupTotal: 4,
    })
    expect(finished.matches.every(match => match.status === 'completed')).toBe(
      true
    )
    expect(finished).toMatchObject({
      completed: true,
      frozen: true,
      cancelled: false,
      notReadyReason: null,
    })
  })
})
