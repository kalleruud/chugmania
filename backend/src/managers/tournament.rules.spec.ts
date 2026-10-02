import loc from '@common/locale/locales'
import type { Participant, TournamentConfig } from '@common/models/tournament'
import {
  configurationOptions,
  firstPendingMatch,
  usedStages,
} from '@common/utils/tournament'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { tournamentDetails } from './tournament.details'
import { generateTournament, schedulePairs } from './tournament.draft'
import {
  groupStandings,
  overallStandings,
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
      assert.ok(error.message.startsWith(loc.no.tournament.downstream))
      assert.ok(error.message.length > loc.no.tournament.downstream.length)
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
test('only the first pending match is featured and inactive reset matches are skipped', () => {
  const { config, players } = input()
  const matches = tournamentDetails(generateTournament(config, players)).matches
  assert.equal(firstPendingMatch(matches)?.id, matches[0].id)
  matches[0].status = 'completed'
  matches[1].status = 'cancelled'
  assert.ok(matches[2].tournament)
  matches[2].tournament.reset = 'conditional'
  assert.ok(matches[3].tournament)
  matches[3].tournament.reset = 'unneeded'
  assert.equal(firstPendingMatch(matches)?.id, matches[4].id)
  matches[4].status = 'completed'
  assert.equal(firstPendingMatch(matches)?.id, matches[5].id)
  matches.forEach(match => {
    match.status = 'completed'
  })
  assert.equal(firstPendingMatch(matches), undefined)
})
test('round robin generates only group play and completes only after every result', () => {
  const { config, players } = input(4)
  Object.assign(config, {
    eliminationType: 'round_robin',
    qualificationTrack: null,
    groupsCount: 1,
    advancementCount: 0,
    stageTracks: { group: ['track'] },
  })
  const state = generateTournament(config, players)
  assert.deepEqual(configurationOptions(2, 'round_robin'), [
    { groups: 1, advancement: 0 },
  ])
  assert.deepEqual(usedStages(config, 4), ['group'])
  assert.equal(state.fixtures.length, 6)
  assert.ok(state.fixtures.every(fixture => fixture.bracket === 'group'))
  assert.equal(tournamentDetails(state).workloadSummary.qualificationLaps, 0)
  assert.equal(tournamentDetails(state).qualification.length, 0)
  assert.ok(
    state.participants.every(
      player => player.duration === null && player.sourceEntry === null
    )
  )
  assert.equal(tournamentDetails(state).workloadSummary.maxMatches, 3)
  const champion = state.participants[0].user
  const last = state.fixtures.at(-1)
  assert.ok(last)
  last.match.status = 'completed'
  last.match.winner = last.match.user1
  assert.equal(overallStandings(state).completed, false)
  for (const fixture of state.fixtures) {
    fixture.match.status = 'completed'
    fixture.match.winner =
      fixture.match.user1 === champion || fixture.match.user2 === champion
        ? champion
        : fixture.match.user1
  }
  assert.equal(overallStandings(state).completed, true)
  assert.equal(overallStandings(state).rows[0].user, champion)
  assert.ok(
    groupStandings(state, state.groups[0].id).every(row => !row.qualifies)
  )
})

for (const mode of ['single', 'double', 'round_robin']) {
  test(`${mode}: head-to-head precedes qualification and the latest played rematch wins`, () => {
    const { config, players } = input(4)
    if (mode === 'single' || mode === 'double' || mode === 'round_robin')
      config.eliminationType = mode
    config.groupsCount = 1
    config.advancementCount = mode === 'round_robin' ? 0 : 4
    if (mode === 'round_robin') config.qualificationTrack = null
    const state = generateTournament(config, players)
    const [a, b, c, d] = players.map(player => player.user)
    const slowerQualifier = state.participants.find(player => player.user === a)
    assert.ok(slowerQualifier)
    slowerQualifier.duration = 3000
    const wins = new Map([
      [`${a}:${b}`, a],
      [`${a}:${c}`, a],
      [`${a}:${d}`, d],
      [`${b}:${c}`, b],
      [`${b}:${d}`, b],
      [`${c}:${d}`, c],
    ])
    for (const fixture of state.fixtures.filter(
      fixture => fixture.bracket === 'group'
    )) {
      const key = [fixture.match.user1, fixture.match.user2].sort().join(':')
      fixture.match.status = 'completed'
      fixture.match.winner = wins.get(key) ?? null
      fixture.playedAt = new Date(10)
    }
    const group = state.groups[0].id
    assert.equal(groupStandings(state, group)[0].user, a)
    const original = state.fixtures.find(
      fixture =>
        fixture.match.winner === a &&
        (fixture.match.user1 === b || fixture.match.user2 === b)
    )
    assert.ok(original)
    const older = structuredClone(original)
    older.id = 'older'
    older.match.id = older.id
    older.playedAt = new Date(20)
    older.match.updatedAt = new Date(9999)
    const latest = structuredClone(original)
    latest.id = 'latest'
    latest.match.id = latest.id
    latest.match.winner = b
    latest.playedAt = new Date(30)
    state.fixtures.push(latest, older)
    assert.equal(groupStandings(state, group)[0].user, b)
    assert.equal(
      overallStandings(state).rows.find(row => row.user === b)?.rank,
      1
    )
    const resolved = resolveSlots(state)
    const firstBracket = resolved.fixtures.find(
      fixture => fixture.bracket === 'upper'
    )
    if (firstBracket) assert.equal(firstBracket.match.user1, b)
  })
}

test('circular head-to-head ties use a deterministic qualification fallback', () => {
  const { config, players } = input(3)
  Object.assign(config, {
    eliminationType: 'round_robin',
    qualificationTrack: null,
    groupsCount: 1,
    advancementCount: 0,
  })
  const state = generateTournament(config, players)
  const [a, b, c] = players.map(player => player.user)
  for (const fixture of state.fixtures) {
    const pair = [fixture.match.user1, fixture.match.user2].sort().join(':')
    fixture.match.status = 'completed'
    fixture.match.winner =
      new Map([
        [`${a}:${b}`, a],
        [`${a}:${c}`, c],
        [`${b}:${c}`, b],
      ]).get(pair) ?? null
  }
  const standings = groupStandings(state, state.groups[0].id)
  assert.equal(standings[0].user, a)
  state.fixtures.reverse()
  assert.deepEqual(groupStandings(state, state.groups[0].id), standings)
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
