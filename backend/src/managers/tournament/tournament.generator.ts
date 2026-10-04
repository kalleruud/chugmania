import loc from '@common/locale/locales'
import type {
  Participant,
  Slot,
  TournamentConfig,
  TournamentFixture,
  TournamentState,
} from '@common/models/tournament'
import { upperStage, validateConfiguration } from '@common/utils/tournament'
import { createHash } from 'node:crypto'
import type { MatchStage } from '../../../database/schema'
import { seedingOrder } from './tournament'

function groupNames(session: string, count: number): string[] {
  const names = loc.no.tournament.groupNames
    .map(name => ({
      name,
      seed: createHash('sha256').update(`${session}:${name}`).digest('hex'),
    }))
    .toSorted((a, b) => a.seed.localeCompare(b.seed))
    .map(row => row.name)
  return Array.from({ length: count }, (_, index) => {
    const name = names[index % names.length]
    const cycle = Math.floor(index / names.length)
    return cycle ? `${name} ${cycle + 1}` : name
  })
}

function snakeGroup(seed: number, groups: number): number {
  const position = seed % groups
  return Math.floor(seed / groups) % 2 === 0 ? position : groups - 1 - position
}

function schedulePairs(players: string[]): [string, string][] {
  const pending: [string, string][] = []
  players.forEach((player, index) =>
    players.slice(index + 1).forEach(other => pending.push([player, other]))
  )
  const result: [string, string][] = []
  const last = new Map<string, number>()
  while (pending.length) {
    const spacing = (pair: [string, string]) =>
      pair
        .map(user => result.length - (last.get(user) ?? -Infinity))
        .sort((a, b) => a - b)
    let best = 0
    for (let i = 1; i < pending.length; i++) {
      const a = spacing(pending[i])
      const b = spacing(pending[best])
      if (a[0] > b[0] || (a[0] === b[0] && a[1] > b[1])) best = i
    }
    const [pair] = pending.splice(best, 1)
    pair.forEach(user => last.set(user, result.length))
    result.push(pair)
  }
  return result
}

export function generateTournament(
  config: TournamentConfig,
  inputs: Participant[]
): TournamentState {
  if (
    !validateConfiguration(
      inputs.length,
      config.groupsCount,
      config.advancementCount,
      config.eliminationType
    )
  )
    throw new Error(loc.no.tournament.roster)
  const groups = groupNames(config.session, config.groupsCount).map(
    (name, position) => ({ id: `group-${position}`, name, position })
  )
  const participants = inputs.toSorted(seedingOrder).map((player, index) => ({
    ...player,
    admission: index,
    groupId: groups[snakeGroup(index, groups.length)].id,
  }))
  const fixtures: TournamentFixture[] = []
  const add = (
    stage: MatchStage,
    bracket: TournamentFixture['bracket'],
    round: number,
    slot1: Slot,
    slot2: Slot,
    groupId: string | null = null
  ): TournamentFixture => {
    const id = `fixture-${fixtures.length}`
    const fixture: TournamentFixture = {
      id,
      groupId,
      bracket,
      round,
      order: fixtures.length,
      slot1,
      slot2,
      reset: 'none',
      match: {
        id,
        user1: null,
        user2: null,
        winner: null,
        duration: null,
        comment: null,
        stage,
        status: 'planned',
        session: config.session,
        track: null,
        createdAt: new Date(0),
        updatedAt: null,
        deletedAt: null,
      },
    }
    if (slot1.kind === 'player') fixture.match.user1 = slot1.user
    if (slot2.kind === 'player') fixture.match.user2 = slot2.user
    fixtures.push(fixture)
    return fixture
  }
  const queues = groups.map(group =>
    schedulePairs(
      participants.filter(p => p.groupId === group.id).map(p => p.user)
    )
  )
  for (let index = 0; queues.some(queue => queue.length > index); index++) {
    groups.forEach((group, groupIndex) => {
      const pair = queues[groupIndex].at(index)
      if (pair)
        add(
          'group',
          'group',
          0,
          { kind: 'player', user: pair[0] },
          { kind: 'player', user: pair[1] },
          group.id
        )
    })
  }
  const seeds: Slot[] = []
  for (let rank = 1; rank <= config.advancementCount; rank++)
    groups.forEach(group =>
      seeds.push({ kind: 'group_rank', groupId: group.id, rank })
    )
  const upperRounds: TournamentFixture[][] = []
  let previous: TournamentFixture[] = []
  let round = 1
  for (let size = seeds.length; size >= 2; size /= 2) {
    const next: TournamentFixture[] = []
    for (let i = 0; i < size / 2; i++) {
      const slot1: Slot = previous.length
        ? { kind: 'match_winner', matchId: previous[i * 2].id }
        : seeds[i]
      const slot2: Slot = previous.length
        ? { kind: 'match_winner', matchId: previous[i * 2 + 1].id }
        : seeds[size - i - 1]
      next.push(add(upperStage(size), 'upper', round, slot1, slot2))
    }
    upperRounds.push(next)
    previous = next
    round++
  }

  if (config.eliminationType === 'double') {
    const winner = (f: TournamentFixture): Slot => ({
      kind: 'match_winner',
      matchId: f.id,
    })
    const loser = (f: TournamentFixture): Slot => ({
      kind: 'match_loser',
      matchId: f.id,
    })
    const upperFinal = previous[0]
    const first = upperRounds[0]
    const groupFixtures = fixtures.filter(f => f.bracket === 'group')
    const firstLowerStage = seeds.length === 8 ? 'loser_quarter' : 'loser_semi'
    const lower = []
    for (let i = 0; i < first.length; i += 2)
      lower.push(
        add(firstLowerStage, 'lower', 1, loser(first[i]), loser(first[i + 1]))
      )
    const ordered = [...groupFixtures, ...first, ...lower]
    let lastLower = lower[0]
    if (seeds.length === 8) {
      const semis = upperRounds[1]
      const drops = [
        add('loser_semi', 'lower', 2, winner(lower[0]), loser(semis[1])),
        add('loser_semi', 'lower', 2, winner(lower[1]), loser(semis[0])),
      ]
      lastLower = add(
        'loser_semi',
        'lower',
        3,
        winner(drops[0]),
        winner(drops[1])
      )
      ordered.push(...semis, ...drops, lastLower)
    }
    const lowerFinal = add(
      'loser_final',
      'lower',
      seeds.length === 8 ? 4 : 2,
      winner(lastLower),
      loser(upperFinal)
    )
    const grandFinal = add(
      'grand_final',
      'final',
      1,
      winner(upperFinal),
      winner(lowerFinal)
    )
    const reset = add(
      'grand_final_reset',
      'final',
      2,
      winner(grandFinal),
      loser(grandFinal)
    )
    reset.reset = 'conditional'
    ordered.push(upperFinal, lowerFinal, grandFinal, reset)
    fixtures.splice(0, fixtures.length, ...ordered)
  }
  const stageCounts = new Map<string, number>()
  const stageTotals = new Map<string, number>()
  fixtures.forEach(fixture => {
    const stage = fixture.match.stage ?? ''
    stageTotals.set(stage, (stageTotals.get(stage) ?? 0) + 1)
  })
  fixtures.forEach((fixture, index) => {
    fixture.order = index
    const stage = fixture.match.stage ?? ''
    const tracks = config.stageTracks[stage] ?? []
    const count = stageCounts.get(stage) ?? 0
    const total = stageTotals.get(stage) ?? 0
    fixture.match.track =
      tracks[Math.floor((count * tracks.length) / total)] ?? null
    stageCounts.set(stage, count + 1)
  })
  return {
    id: 'preview',
    config,
    participants,
    groups,
    fixtures,
    frozenAt: null,
    notReadyReason: null,
    cancelled: false,
  }
}
