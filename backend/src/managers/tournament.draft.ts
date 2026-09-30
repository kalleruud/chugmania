import loc from '@common/locale/locales'
import type {
  Participant,
  Slot,
  TournamentConfig,
  TournamentFixture,
  TournamentState,
} from '@common/models/tournament'
import { upperStage, validConfiguration } from '@common/utils/tournament'
import type { MatchStage } from '../../database/schema'
import { qualificationOrder } from './tournament.rules'

export function groupName(index: number): string {
  let name = ''
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26))
    name = String.fromCharCode(65 + ((value - 1) % 26)) + name
  return name
}
export function snakeGroup(seed: number, groups: number): number {
  const position = seed % groups
  return Math.floor(seed / groups) % 2 === 0 ? position : groups - 1 - position
}
export function schedulePairs(players: string[]): [string, string][] {
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
    !validConfiguration(
      inputs.length,
      config.groupsCount,
      config.advancementCount,
      config.eliminationType
    )
  )
    throw new Error(loc.no.tournament.roster)
  if (config.eliminationType !== 'single')
    throw new Error(loc.no.tournament.invalid)
  const groups = Array.from({ length: config.groupsCount }, (_, index) => ({
    id: `group-${index}`,
    name: groupName(index),
  }))
  const participants = inputs
    .toSorted(qualificationOrder)
    .map((player, index) => ({
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
    const stageIndex = fixtures.filter(f => f.match.stage === stage).length
    const tracks = config.stageTracks[stage] ?? []
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
        track: tracks[stageIndex % tracks.length] ?? null,
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
    previous = next
    round++
  }
  return {
    id: 'preview',
    config,
    participants,
    groups,
    fixtures,
    frozenAt: null,
    admissionClosedAt: null,
    notReadyReason: null,
    cancelled: false,
  }
}
