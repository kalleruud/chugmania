import loc from '@common/locale/locales'
import type { Participant, TournamentConfig } from '@common/models/tournament'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { tournamentDetails } from './tournament.details'
import { generateTournament, schedulePairs } from './tournament.draft'
import {
  groupStandings,
  protectResults,
  resolveSlots,
} from './tournament.rules'

export function input(count = 8): {
  config: TournamentConfig
  players: Participant[]
} {
  return {
    config: {
      session: 'session',
      name: 'Cup',
      description: '',
      qualificationTrack: 'track',
      groupsCount: 2,
      advancementCount: 2,
      eliminationType: 'single',
      stageTracks: {
        group: ['track', 'second'],
        semi: ['track'],
        final: ['track'],
      },
    },
    players: Array.from({ length: count }, (_, index) => ({
      user: `player-${index}`,
      duration: index < 4 ? 1000 + index : null,
      rating: 1000 - index,
      admission: 0,
      groupId: '',
      sourceEntry: index < 4 ? `entry-${index}` : null,
    })),
  }
}
test('one deterministic draft supplies preview, snake groups, all pairs and isolated stage tracks', () => {
  const { config, players } = input()
  const draft = generateTournament(config, players)
  assert.deepEqual(draft, generateTournament(config, players.toReversed()))
  assert.deepEqual(
    draft.groups.map(g =>
      draft.participants.filter(p => p.groupId === g.id).map(p => p.user)
    ),
    [
      ['player-0', 'player-3', 'player-4', 'player-7'],
      ['player-1', 'player-2', 'player-5', 'player-6'],
    ]
  )
  assert.equal(draft.fixtures.length, 15)
  assert.deepEqual(
    draft.fixtures
      .filter(f => f.match.stage === 'group')
      .map(f => f.match.track),
    [...Array<string>(6).fill('track'), ...Array<string>(6).fill('second')]
  )
  assert.equal(
    new Set(schedulePairs(players.map(p => p.user)).map(pair => pair.join(':')))
      .size,
    28
  )
  assert.equal(
    tournamentDetails(draft).matches[12].tournament?.slot1,
    `Vinner av gruppe ${draft.groups[0].name}`
  )
  assert.equal(new Set(draft.groups.map(group => group.name)).size, 2)
  assert.ok(draft.groups.every(group => group.name.length > 1))
  const otherSession = generateTournament(
    { ...config, session: 'other-session' },
    players
  )
  assert.notDeepEqual(
    draft.groups.map(group => group.name),
    otherSession.groups.map(group => group.name)
  )
  const missing = generateTournament(
    { ...config, stageTracks: { group: ['track'] } },
    players
  )
  assert.ok(
    missing.fixtures
      .filter(f => f.bracket !== 'group')
      .every(f => f.match.track === null)
  )
})
test('normal results progress to a champion; decided downstream results protect their feeders', () => {
  const { config, players } = input()
  let state = resolveSlots(generateTournament(config, players))
  assert.ok(
    state.fixtures
      .filter(f => f.bracket !== 'group')
      .every(f => f.match.user1 === null)
  )
  for (const fixture of state.fixtures.filter(f => f.bracket === 'group')) {
    fixture.match.status = 'completed'
    fixture.match.winner = fixture.match.user1
  }
  state = resolveSlots(state)
  const first = state.fixtures.find(f => f.bracket === 'upper')
  assert.ok(first?.match.user1)
  first.match.status = 'completed'
  first.match.winner = first.match.user1
  const other = state.fixtures.filter(f => f.bracket === 'upper')[1]
  other.match.status = 'completed'
  other.match.winner = other.match.user1
  state = resolveSlots(state)
  const final = state.fixtures.at(-1)
  assert.ok(final?.match.user1)
  final.match.status = 'completed'
  final.match.winner = final.match.user1
  assert.equal(tournamentDetails(state).completed, true)
  assert.equal(tournamentDetails(state).standings[0].user, final.match.winner)
  const proposed = structuredClone(state)
  const feeder = proposed.fixtures.find(f => f.id === first.id)
  assert.ok(feeder)
  feeder.match.winner = feeder.match.user2
  assert.throws(
    () => protectResults(state, resolveSlots(proposed), feeder.id),
    (error: unknown) => {
      assert.ok(error instanceof Error)
      assert.match(
        error.message,
        /Kan ikke endre en match som andre matcher er avhengig av\./
      )
      assert.match(error.message, /Angre først resultatene i: .+/)
      assert.equal(loc.no.match.toast.update.error(error), error.message)
      return true
    }
  )
})
test('qualification fallback orders highest ratings first and empty groups have standings', () => {
  const { config, players } = input()
  players.forEach(p => {
    p.duration = null
  })
  players[7].rating = 2000
  const state = generateTournament(config, players)
  assert.equal(state.participants[0].user, 'player-7')
  assert.equal(groupStandings(state, state.groups[0].id)[0].user, 'player-7')
})

for (const advancers of [4, 8]) {
  for (const reset of [false, true]) {
    test(`double elimination ${advancers} players, reset ${reset}`, () => {
      const { config, players } = input(advancers)
      config.groupsCount = advancers
      config.advancementCount = 1
      config.eliminationType = 'double'
      config.stageTracks = Object.fromEntries(
        [
          'semi',
          'quarter',
          'final',
          'loser_quarter',
          'loser_semi',
          'loser_final',
          'grand_final',
          'grand_final_reset',
        ].map(stage => [stage, ['track']])
      )
      let state = resolveSlots(generateTournament(config, players))
      assert.equal(state.fixtures.length, advancers * 2 - 1)
      assert.equal(state.fixtures.at(-1)?.reset, 'conditional')
      for (let index = 0; index < state.fixtures.length; index++) {
        const fixture = state.fixtures[index]
        if (fixture.reset === 'unneeded') continue
        assert.ok(fixture.match.user1, fixture.match.stage ?? '')
        assert.ok(fixture.match.user2)
        fixture.match.status = 'completed'
        fixture.match.winner =
          fixture.match.stage === 'grand_final' && reset
            ? fixture.match.user2
            : fixture.match.user1
        state = resolveSlots(state)
      }
      assert.equal(tournamentDetails(state).completed, true)
      assert.equal(
        state.fixtures.at(-1)?.reset,
        reset ? 'required' : 'unneeded'
      )
      assert.equal(
        tournamentDetails(state).progress.decided,
        advancers * 2 - (reset ? 1 : 2)
      )
      assert.equal(tournamentDetails(state).standings.length, advancers)
      assert.equal(tournamentDetails(state).standings[0].rank, 1)
    })
  }
}
