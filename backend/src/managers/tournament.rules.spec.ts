import loc from '@common/locale/locales'
import type { Participant, TournamentConfig } from '@common/models/tournament'
import { firstPendingMatch, pendingMatches } from '@common/utils/tournament'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { tournamentDetails } from './tournament.details'
import { generateTournament, schedulePairs } from './tournament.draft'
import {
  groupStandings,
  protectResults,
  resolveSlots,
  tieBreaks,
} from './tournament.rules'

export function input(count = 8): {
  config: TournamentConfig
  players: Participant[]
} {
  return {
    config: {
      session: 'session',
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
      duration: 1000 + index,
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
    '1st Gr A'
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
      assert.ok(error.message.startsWith(loc.no.tournament.downstream))
      assert.ok(error.message.length > loc.no.tournament.downstream.length)
      assert.equal(loc.no.match.toast.update.error(error), error.message)
      return true
    }
  )
})
test('short match and group labels identify unresolved slots', () => {
  const { config, players } = input()
  config.groupsCount = 4
  const details = tournamentDetails(generateTournament(config, players))
  assert.equal(details.matches[0].tournament?.label, 'GS01')
  assert.equal(
    details.matches.filter(match => match.stage === 'quarter')[2].tournament
      ?.label,
    'QF03'
  )
  assert.equal(
    details.matches.filter(match => match.stage === 'semi')[1].tournament
      ?.slot1,
    'W QF03'
  )
  assert.equal(
    details.matches.find(match => match.stage === 'quarter')?.tournament?.slot2,
    '2nd Gr D'
  )
  assert.deepEqual(
    details.groups.map(group => group.code),
    ['A', 'B', 'C', 'D']
  )
  assert.ok(details.groups.every(group => group.name.length > 1))
  config.eliminationType = 'double'
  const double = tournamentDetails(generateTournament(config, players))
  assert.equal(
    double.matches.find(match => match.stage === 'loser_quarter')?.tournament
      ?.slot1,
    'L QF01'
  )
  const larger = input(32)
  larger.config.groupsCount = 32
  larger.config.advancementCount = 1
  assert.equal(
    tournamentDetails(generateTournament(larger.config, larger.players))
      .groups[26].code,
    'AA'
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
test('current and next matches follow the schedule and skip inactive matches', () => {
  const { config, players } = input()
  const matches = tournamentDetails(generateTournament(config, players)).matches
  assert.equal(firstPendingMatch(matches)?.id, matches[0].id)
  assert.deepEqual(pendingMatches(matches).slice(0, 2), matches.slice(0, 2))
  matches[0].status = 'completed'
  matches[1].status = 'cancelled'
  assert.ok(matches[2].tournament)
  matches[2].tournament.reset = 'conditional'
  assert.ok(matches[3].tournament)
  matches[3].tournament.reset = 'unneeded'
  assert.equal(firstPendingMatch(matches)?.id, matches[4].id)
  assert.deepEqual(pendingMatches(matches).slice(0, 2), matches.slice(4, 6))
  matches[4].deletedAt = new Date()
  assert.equal(firstPendingMatch(matches)?.id, matches[5].id)
  matches.forEach(match => {
    match.status = 'completed'
  })
  assert.equal(firstPendingMatch(matches), undefined)
  assert.deepEqual(pendingMatches(matches), [])
  matches[5].status = 'planned'
  assert.deepEqual(pendingMatches(matches), [matches[5]])
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

test('settled group ties block slots, use short labels and wait for every requested lap', () => {
  const { config, players } = input(6)
  config.advancementCount = 1
  players.forEach(p => {
    p.duration = null
    p.sourceEntry = null
  })
  let state = generateTournament(config, players)
  assert.equal(tieBreaks(state).length, 0)
  assert.equal(tournamentDetails(state).qualificationEntries.length, 0)
  for (const group of state.groups) {
    const members = state.participants
      .filter(p => p.groupId === group.id)
      .map(p => p.user)
    for (const fixture of state.fixtures.filter(f => f.groupId === group.id)) {
      fixture.match.status = 'completed'
      const [a, b] = [
        members.indexOf(fixture.match.user1 ?? ''),
        members.indexOf(fixture.match.user2 ?? ''),
      ]
      fixture.match.winner =
        (a + 1) % 3 === b ? fixture.match.user1 : fixture.match.user2
    }
  }
  state = resolveSlots(state)
  assert.equal(tieBreaks(state).length, 2)
  const names = new Map(players.map((p, i) => [p.user, `P${i}`]))
  const final = tournamentDetails(state, [], names).matches.at(-1)
  assert.ok(final)
  assert.equal(final.user1, null)
  assert.match(final.tournament?.slot1 ?? '', /^TB P\d v P\d v P\d$/)
  state.participants[0].duration = 1000
  assert.equal(resolveSlots(state).fixtures.at(-1)?.match.user1, null)
  state.participants.forEach((p, index) => {
    p.duration = 1000 + index
  })
  state = resolveSlots(state)
  assert.equal(tieBreaks(state).length, 0)
  assert.ok(state.fixtures.at(-1)?.match.user1)
  assert.ok(state.fixtures.at(-1)?.match.user2)
})

test('eliminated players need laps after their round settles; repeat laps preserve group seeding', () => {
  const { config, players } = input()
  let state = generateTournament(config, players)
  for (const fixture of state.fixtures.filter(f => f.bracket === 'group')) {
    fixture.match.status = 'completed'
    fixture.match.winner = fixture.match.user1
  }
  state = resolveSlots(state)
  const semis = state.fixtures.filter(f => f.match.stage === 'semi')
  assert.equal(semis.length, 2)
  semis[0].match.status = 'completed'
  semis[0].match.winner = semis[0].match.user1
  const loser1 = state.participants.find(p => p.user === semis[0].match.user2)
  const loser2 = state.participants.find(p => p.user === semis[1].match.user2)
  assert.ok(loser1 && loser2)
  loser1.latestDuration = null
  loser2.latestDuration = null
  assert.ok(!tieBreaks(state).some(tie => tie.users.includes(loser1.user)))
  semis[1].match.status = 'completed'
  semis[1].match.winner = semis[1].match.user1
  assert.ok(
    tieBreaks(state).some(
      tie =>
        tie.groupId === null &&
        tie.users.includes(loser1.user) &&
        tie.users.includes(loser2.user)
    )
  )
  loser1.latestDuration = 3000
  loser2.latestDuration = 3000
  assert.ok(tieBreaks(state).some(tie => tie.users.includes(loser1.user)))
  loser1.latestDuration = 5000
  loser2.latestDuration = 4000
  const next = resolveSlots(state)
  assert.deepEqual(
    next.fixtures
      .filter(f => f.match.stage === 'semi')
      .map(f => [f.match.user1, f.match.user2]),
    semis.map(f => [f.match.user1, f.match.user2])
  )
  assert.equal(tieBreaks(next).length, 0)
  const final = next.fixtures.at(-1)
  assert.ok(final)
  final.match.status = 'completed'
  final.match.winner = final.match.user1
  assert.equal(tournamentDetails(next).completed, true)
})
