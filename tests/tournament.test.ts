import type { Match } from '@common/models/match'
import type {
  TournamentConfig,
  TournamentDetails,
} from '@common/models/tournament'
import { getTournamentStages } from '@common/utils/tournament'
import { beforeAll, describe, expect, test } from 'bun:test'
import assert from 'node:assert/strict'
import type { MatchStage } from '../backend/database/schema'
import MatchManager from '../backend/src/managers/match.manager'
import RatingManager from '../backend/src/managers/rating.manager'
import SessionManager from '../backend/src/managers/session.manager'
import TimeEntryManager from '../backend/src/managers/timeEntry.manager'
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
  reopen(): Promise<void>
  setPlayers(players: Partial<Pick<Match, 'user1' | 'user2'>>): Promise<void>
}

async function CreateTournament(options: {
  config: Omit<TournamentConfig, 'session' | 'stageTracks' | 'tieBreakerTrack'>
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
    await createRsvps({ yes: players.length, no: 0, maybe: 0 }, players)
  )
  const config: TournamentConfig = {
    ...options.config,
    session: session.id,
    stageTracks: {},
    tieBreakerTrack: tracks[0].id,
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
        async reopen(): Promise<void> {
          await MatchManager.onEditMatch(socket, {
            type: 'EditMatchRequest',
            id: match.id,
            status: 'planned',
            winner: null,
          }).then(assertResponse)
        },
        async setPlayers(
          players: Partial<Pick<Match, 'user1' | 'user2'>>
        ): Promise<void> {
          await MatchManager.onEditMatch(socket, {
            type: 'EditMatchRequest',
            id: match.id,
            ...players,
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
    socket,
    players,
    session,
    async editLap(
      user: string,
      updates: {
        duration?: number
        status?: 'completed' | 'cancelled' | 'planned'
      }
    ) {
      const lap = (await getDetails()).tieBreakers.find(
        lap => lap.user === user
      )
      assert(lap, `Missing lap: ${user}`)
      const { onEditTimeEntry } = TimeEntryManager
      await onEditTimeEntry(socket, {
        type: 'EditTimeEntryRequest',
        id: lap.id,
        ...updates,
      }).then(assertResponse)
    },
    getMatches,
    getMatch,
    getState: getDetails,
    async getGroup(code: string): Promise<TournamentDetails['groups'][number]> {
      const group = (await getDetails()).groups.find(
        group => group.code === code
      )
      assert(group, `Unknown group: ${code}`)
      return group
    },
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

async function setResults(
  matches: TestMatch[],
  results: Record<string, string[]>
): Promise<void> {
  for (const [winner, opponents] of Object.entries(results)) {
    for (const opponent of opponents) {
      const match = matches.find(
        match =>
          [match.user1, match.user2].includes(winner) &&
          [match.user1, match.user2].includes(opponent)
      )
      assert(match, `Missing match: ${winner} vs ${opponent}`)
      await match.setWinner(winner)
    }
  }
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
    expect(state.tieBreakers).toHaveLength(6)
    expect(
      state.tieBreakers.every(lap => !lap.required && lap.status === 'planned')
    ).toBe(true)
    await tournament.editLap('charlie', { status: 'cancelled' })
    expect(
      (await tournament.getState()).tieBreakers.filter(
        lap => lap.status === 'cancelled'
      )
    ).toHaveLength(1)
    await tournament.editLap('daniel', { status: 'cancelled' })
    expect(
      (await tournament.getState()).standings.filter(row =>
        ['charlie', 'daniel'].includes(row.user)
      )
    ).toEqual([
      { user: 'charlie', rank: 3 },
      { user: 'daniel', rank: 3 },
    ])
    for (const [index, user] of ['erin', 'frank', 'grace', 'hugo'].entries()) {
      await tournament.editLap(user, { duration: 10000 + index * 1000 })
      if (index === 0)
        expect((await tournament.getState()).standings.slice(4)).toEqual([
          { user: 'erin', rank: 5 },
          { user: 'frank', rank: 6 },
          { user: 'grace', rank: 6 },
          { user: 'hugo', rank: 6 },
        ])
    }
    expect((await tournament.getState()).standings.slice(4)).toEqual([
      { user: 'erin', rank: 5 },
      { user: 'frank', rank: 6 },
      { user: 'grace', rank: 7 },
      { user: 'hugo', rank: 8 },
    ])
    const ids = (await tournament.getState()).tieBreakers
      .map(lap => lap.id)
      .sort()
    TournamentManager.reconcileAll()
    expect(
      (await tournament.getState()).tieBreakers.map(lap => lap.id).sort()
    ).toEqual(ids)
  })
})

describe('Complete double elimination tournament with a manual tie-break', () => {
  let tournament: Awaited<ReturnType<typeof CreateTournament>>

  beforeAll(async () => {
    tournament = await CreateTournament({
      config: {
        groupsCount: 4,
        advancementCount: 2,
        eliminationType: 'double',
      },
      tracks: 2,
      users: [
        'amy',
        'ben',
        'cora',
        'drew',
        'eve',
        'finn',
        'gina',
        'hal',
        'ivy',
        'jack',
        'kate',
        'liam',
        'mia',
      ],
    })
  })

  test.serial('Triangle tie blocks quarterfinals', async () => {
    // Arrange
    const matches = await tournament.getMatches('group')
    const results = {
      amy: ['hal', 'ivy'],
      hal: ['ivy'],
      ben: ['gina'],
      gina: ['jack'],
      jack: ['ben'],
      cora: ['finn', 'kate'],
      finn: ['kate'],
      drew: ['eve', 'liam', 'mia'],
      eve: ['liam', 'mia'],
      liam: ['mia'],
    }
    const tied = {
      rank: 1,
      wins: 1,
      losses: 1,
      resolved: false,
      qualifies: false,
    }

    // Act
    await setResults(matches, results)

    // Assert
    expect((await tournament.getGroup('B')).standings).toMatchObject([
      { ...tied, user: 'ben' },
      { ...tied, user: 'gina' },
      { ...tied, user: 'jack' },
    ])
    expect(await tournament.getMatches('quarter')).toMatchObject([
      { user1: 'amy', user2: 'eve' },
      { user1: null, user2: 'finn' },
      { user1: 'cora', user2: null },
      { user1: 'drew', user2: 'hal' },
    ])
  })

  test.serial('Choose tied players manually', async () => {
    // Arrange
    const quarters = await tournament.getMatches('quarter')

    // Act
    await quarters[1].setPlayers({ user1: 'ben' })
    await quarters[2].setPlayers({ user2: 'gina' })

    // Assert
    expect(await tournament.getMatches('quarter')).toMatchObject([
      { user1: 'amy', user2: 'eve' },
      { user1: 'ben', user2: 'finn' },
      { user1: 'cora', user2: 'gina' },
      { user1: 'drew', user2: 'hal' },
    ])
  })

  test.serial('Quarterfinal losers enter lower bracket', async () => {
    // Arrange
    const quarters = await tournament.getMatches('quarter')

    // Act
    await setWinners(quarters, ['amy', 'ben', 'cora', 'drew'])

    // Assert
    expect(await tournament.getMatches('loser_quarter')).toMatchObject([
      { user1: 'eve', user2: 'finn', status: 'planned' },
      { user1: 'gina', user2: 'hal', status: 'planned' },
    ])
  })

  test.serial('Complete lower quarterfinals', async () => {
    // Arrange
    const lowerQuarters = await tournament.getMatches('loser_quarter')

    // Act
    await setWinners(lowerQuarters, ['finn', 'gina'])

    // Assert
    expect(await tournament.getMatches('loser_semi')).toMatchObject([
      { user1: 'finn', user2: null },
      { user1: 'gina', user2: null },
      { user1: null, user2: null },
    ])
  })

  test.serial('Upper semifinal losers drop down', async () => {
    // Arrange
    const semifinals = await tournament.getMatches('semi')

    // Act
    await setWinners(semifinals, ['amy', 'cora'])

    // Assert
    expect(await tournament.getMatches('loser_semi')).toMatchObject([
      { user1: 'finn', user2: 'drew' },
      { user1: 'gina', user2: 'ben' },
      { user1: null, user2: null },
    ])
  })

  test.serial('Complete lower semifinals', async () => {
    // Arrange
    const lowerSemifinals = await tournament.getMatches('loser_semi')

    // Act
    await lowerSemifinals[0].setWinner('finn')
    await lowerSemifinals[1].setWinner('ben')
    await lowerSemifinals[2].setWinner('ben')

    // Assert
    expect(await tournament.getMatch('loser_final')).toMatchObject({
      user1: 'ben',
      user2: null,
    })
  })

  test.serial('Upper final loser gets a second chance', async () => {
    // Arrange
    const final = await tournament.getMatch('final')

    // Act
    await final.setWinner('amy')

    // Assert
    expect(await tournament.getMatch('loser_final')).toMatchObject({
      user1: 'ben',
      user2: 'cora',
    })
    expect(await tournament.getMatch('grand_final')).toMatchObject({
      user1: 'amy',
      user2: null,
    })
  })

  test.serial('Lower champion reaches grand final', async () => {
    // Arrange
    const lowerFinal = await tournament.getMatch('loser_final')

    // Act
    await lowerFinal.setWinner('ben')

    // Assert
    expect(await tournament.getMatch('grand_final')).toMatchObject({
      user1: 'amy',
      user2: 'ben',
      status: 'planned',
    })
    expect(await tournament.getMatch('grand_final_reset')).toMatchObject({
      user1: null,
      user2: null,
      winner: null,
    })
  })

  test.serial('Grand final forces a reset', async () => {
    // Arrange
    const grandFinal = await tournament.getMatch('grand_final')

    // Act
    await grandFinal.setWinner('ben')

    // Assert
    expect(await tournament.getMatch('grand_final_reset')).toMatchObject({
      user1: 'ben',
      user2: 'amy',
      status: 'planned',
    })
    expect(await tournament.getState()).toMatchObject({
      completed: false,
      progress: { decided: 29, total: 30 },
    })
  })

  test.serial('Reset decides final standings', async () => {
    // Arrange
    const reset = await tournament.getMatch('grand_final_reset')

    // Act
    await reset.setWinner('ben')

    // Assert
    expect(await tournament.getMatch('grand_final_reset')).toMatchObject({
      winner: 'ben',
      status: 'completed',
    })
    const state = await tournament.getState()
    expect(state).toMatchObject({
      completed: true,
      progress: { decided: 30, total: 30, groupDecided: 15, groupTotal: 15 },
    })
    expect(state.standings.slice(0, 8)).toEqual([
      { user: 'ben', rank: 1 },
      { user: 'amy', rank: 2 },
      { user: 'cora', rank: 3 },
      { user: 'finn', rank: 4 },
      { user: 'drew', rank: 5 },
      { user: 'gina', rank: 5 },
      { user: 'eve', rank: 7 },
      { user: 'hal', rank: 7 },
    ])
  })
})

test.serial(
  'Simple tournament advances a victory circle using required lap times',
  async () => {
    const tournament = await CreateTournament({
      config: {
        groupsCount: 1,
        advancementCount: 2,
        eliminationType: 'single',
      },
      tracks: 1,
      users: ['tie-a', 'tie-b', 'tie-c', 'tie-d'],
    })
    const groups = await tournament.getMatches('group')
    await setResults(groups, {
      'tie-a': ['tie-b', 'tie-d'],
      'tie-b': ['tie-c', 'tie-d'],
      'tie-c': ['tie-a', 'tie-d'],
    })
    let state = await tournament.getState()
    expect(state.tieBreakers).toHaveLength(3)
    expect(
      state.tieBreakers.every(lap => lap.status === 'planned' && lap.required)
    ).toBe(true)
    expect(await tournament.getMatch('final')).toMatchObject({
      user1: null,
      user2: null,
    })
    expect(
      state.groups[0].standings.every(row => row.explanation === null)
    ).toBe(true)
    const ids = state.tieBreakers.map(lap => lap.id).sort()
    const reopened = groups.find(
      match =>
        [match.user1, match.user2].includes('tie-c') &&
        [match.user1, match.user2].includes('tie-d')
    )
    assert(reopened)
    await reopened.reopen()
    expect((await tournament.getState()).tieBreakers).toHaveLength(0)
    await reopened.setWinner('tie-c')
    expect(
      (await tournament.getState()).tieBreakers.map(lap => lap.id).sort()
    ).toEqual(ids)
    await tournament.editLap('tie-a', { duration: 30000 })
    expect(await tournament.getMatch('final')).toMatchObject({
      user1: 'tie-a',
      user2: null,
    })
    await tournament.editLap('tie-b', { duration: 20000 })
    expect(await tournament.getMatch('final')).toMatchObject({
      user1: 'tie-b',
      user2: 'tie-a',
    })
    await tournament.editLap('tie-c', { duration: 10000 })
    expect(await tournament.getMatch('final')).toMatchObject({
      user1: 'tie-c',
      user2: 'tie-b',
    })
    expect(
      (await tournament.getState()).groups[0].standings
        .slice(0, 3)
        .map(row => row.explanation)
    ).toEqual(['tie_breaker', 'tie_breaker', 'tie_breaker'])
    expect(
      TimeEntryManager.getAllLatestAfterSession(tournament.session.id)
        .map(lap => lap.user)
        .sort()
    ).toEqual(['tie-a', 'tie-b', 'tie-c'])
    expect(RatingManager.getUserRatings('tie-c')).toBeDefined()
    await (await tournament.getMatch('final')).setWinner('tie-c')
    state = await tournament.getState()
    expect(state.completed).toBe(true)
    expect(state.progress).toMatchObject({ decided: 7, total: 7 })
    expect(state.tieBreakers).toHaveLength(3)
    expect(state.standings).toEqual([
      { user: 'tie-c', rank: 1 },
      { user: 'tie-b', rank: 2 },
      { user: 'tie-a', rank: 3 },
      { user: 'tie-d', rank: 4 },
    ])
    await assert.rejects(tournament.editLap('tie-a', { duration: 5000 }))
    expect(
      (await tournament.getState()).tieBreakers.find(
        lap => lap.user === 'tie-a'
      )?.duration
    ).toBe(30000)
  }
)

test.serial(
  'Mandatory cancellations are individual and equal times use frozen ranking',
  async () => {
    const tournament = await CreateTournament({
      config: {
        groupsCount: 1,
        advancementCount: 2,
        eliminationType: 'single',
      },
      tracks: 1,
      users: ['cancel-a', 'cancel-b', 'cancel-c', 'cancel-d'],
    })
    await setResults(await tournament.getMatches('group'), {
      'cancel-a': ['cancel-b', 'cancel-d'],
      'cancel-b': ['cancel-c', 'cancel-d'],
      'cancel-c': ['cancel-a', 'cancel-d'],
    })
    const lap = (await tournament.getState()).tieBreakers.find(
      lap => lap.user === 'cancel-b'
    )
    assert(lap)
    const owner = tournament.players.find(player => player.id === 'cancel-b')
    assert(owner)
    await assert.rejects(
      TimeEntryManager.onEditTimeEntry(await login(owner), {
        type: 'EditTimeEntryRequest',
        id: lap.id,
        status: 'cancelled',
      })
    )
    await tournament.editLap('cancel-c', { status: 'cancelled' })
    expect(
      (await tournament.getState()).tieBreakers.filter(
        lap => lap.status === 'planned'
      )
    ).toHaveLength(2)
    await tournament.editLap('cancel-a', { duration: 10000 })
    await tournament.editLap('cancel-b', { duration: 10000 })
    expect(await tournament.getMatch('final')).toMatchObject({
      user1: 'cancel-a',
      user2: 'cancel-b',
    })
    expect(
      TimeEntryManager.getAllLatestAfterSession(tournament.session.id).some(
        lap => lap.user === 'cancel-c'
      )
    ).toBe(false)
    await tournament.editLap('cancel-c', { status: 'planned' })
    expect(await tournament.getMatch('final')).toMatchObject({
      user1: 'cancel-a',
      user2: 'cancel-b',
    })
    await tournament.editLap('cancel-c', {
      duration: 5000,
      status: 'cancelled',
    })
    expect(
      (await tournament.getState()).tieBreakers.find(
        lap => lap.user === 'cancel-c'
      )?.status
    ).toBe('completed')
    expect(await tournament.getMatch('final')).toMatchObject({
      user1: 'cancel-c',
      user2: 'cancel-a',
    })

    const track = (await tournament.getState()).config.tieBreakerTrack
    assert(track)
    await assert.rejects(
      TimeEntryManager.onPostTimeEntry(tournament.socket, {
        type: 'CreateTimeEntryRequest',
        id: 'client-managed-tie-breaker',
        user: 'cancel-a',
        session: tournament.session.id,
        track,
        tieBreaker: true,
      })
    )
    for (const requestedStatus of ['planned', 'cancelled']) {
      const status: 'planned' | 'cancelled' =
        requestedStatus === 'planned' ? 'planned' : 'cancelled'
      const id = `positive-duration-${status}`
      await TimeEntryManager.onPostTimeEntry(tournament.socket, {
        type: 'CreateTimeEntryRequest',
        id,
        tieBreaker: false,
        user: 'cancel-a',
        track,
        duration: 1000,
        status,
      }).then(assertResponse)
      expect(
        (await TimeEntryManager.getAllTimeEntries()).find(lap => lap.id === id)
          ?.status
      ).toBe('completed')
      await TimeEntryManager.onEditTimeEntry(tournament.socket, {
        type: 'EditTimeEntryRequest',
        id,
        status,
      }).then(assertResponse)
      expect(
        (await TimeEntryManager.getAllTimeEntries()).find(lap => lap.id === id)
          ?.status
      ).toBe('completed')
      await TimeEntryManager.onEditTimeEntry(tournament.socket, {
        type: 'EditTimeEntryRequest',
        id,
        duration: null,
        status,
      }).then(assertResponse)
      expect(
        (await TimeEntryManager.getAllTimeEntries()).find(lap => lap.id === id)
          ?.status
      ).toBe(status)
      await TimeEntryManager.onEditTimeEntry(tournament.socket, {
        type: 'EditTimeEntryRequest',
        id,
        duration: 2000,
        status,
      }).then(assertResponse)
      expect(
        (await TimeEntryManager.getAllTimeEntries()).find(lap => lap.id === id)
          ?.status
      ).toBe('completed')
    }
  }
)

test.serial(
  'Multiple mandatory cancellations fall back to ranking and survive reopening',
  async () => {
    const tournament = await CreateTournament({
      config: {
        groupsCount: 1,
        advancementCount: 2,
        eliminationType: 'single',
      },
      tracks: 1,
      users: ['fallback-a', 'fallback-b', 'fallback-c', 'fallback-d'],
    })
    const matches = await tournament.getMatches('group')
    await setResults(matches, {
      'fallback-a': ['fallback-b', 'fallback-d'],
      'fallback-b': ['fallback-c', 'fallback-d'],
      'fallback-c': ['fallback-a', 'fallback-d'],
    })
    const ids = (await tournament.getState()).tieBreakers
      .map(lap => lap.id)
      .sort()
    for (const user of ['fallback-a', 'fallback-b', 'fallback-c'])
      await tournament.editLap(user, { status: 'cancelled' })
    expect(await tournament.getMatch('final')).toMatchObject({
      user1: 'fallback-a',
      user2: 'fallback-b',
    })
    const reopened = matches.find(
      match =>
        [match.user1, match.user2].includes('fallback-c') &&
        [match.user1, match.user2].includes('fallback-d')
    )
    assert(reopened)
    await reopened.reopen()
    expect(await tournament.getMatch('final')).toMatchObject({
      user1: null,
      user2: null,
    })
    await reopened.setWinner('fallback-c')
    const state = await tournament.getState()
    expect(state.tieBreakers.map(lap => lap.id).sort()).toEqual(ids)
    expect(state.tieBreakers.every(lap => lap.status === 'cancelled')).toBe(
      true
    )
    expect(await tournament.getMatch('final')).toMatchObject({
      user1: 'fallback-a',
      user2: 'fallback-b',
    })
  }
)
