import type {
  SlotDependency,
  TournamentStageTracksConfig,
} from '@common/models/tournament'
import type {
  EliminationType,
  MatchStage,
  TournamentBracket,
} from '../../database/schema'

export type DraftGroup = {
  key: string
  name: string
  memberUserIds: string[]
}

export type DraftMatch = {
  key: string
  name: string
  bracket: TournamentBracket
  stage: MatchStage
  sortOrder: number
  user1: string | null
  user2: string | null
  slot1: SlotDependency | null
  slot2: SlotDependency | null
  trackId: string | null
}

export type TournamentDraft = {
  groups: DraftGroup[]
  matches: DraftMatch[]
  usedStages: MatchStage[]
}

const INF = Number.POSITIVE_INFINITY

function comparePairScore(
  a: readonly [number, number],
  b: readonly [number, number]
): number {
  const c0 = Math.sign(b[0] - a[0])
  if (c0 !== 0) return c0
  return Math.sign(b[1] - a[1])
}

function orderRoundRobinPairs(memberIds: string[]): [string, string][] {
  const pairs: [string, string][] = []
  const n = memberIds.length
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      pairs.push([memberIds[i], memberIds[j]])
    }
  }
  const remaining = new Set(pairs.map((_, idx) => idx))
  const ordered: [string, string][] = []
  const lastIndex = new Map<string, number>()

  function scoreForPair(u: string, v: string, L: number): [number, number] {
    const sp = (user: string) => {
      const lp = lastIndex.get(user)
      if (lp === undefined) return INF
      return L - lp
    }
    const su = sp(u)
    const sv = sp(v)
    return [Math.min(su, sv), Math.max(su, sv)]
  }

  while (remaining.size > 0) {
    let bestIdx = -1
    let bestScore: [number, number] = [-INF, -INF]
    const L = ordered.length
    for (const idx of remaining) {
      const [u, v] = pairs[idx]
      const sc = scoreForPair(u, v, L)
      if (
        bestIdx < 0 ||
        comparePairScore(sc, bestScore) > 0 ||
        (comparePairScore(sc, bestScore) === 0 && idx < bestIdx)
      ) {
        bestIdx = idx
        bestScore = sc
      }
    }
    const pick = pairs[bestIdx]
    ordered.push(pick)
    lastIndex.set(pick[0], ordered.length - 1)
    lastIndex.set(pick[1], ordered.length - 1)
    remaining.delete(bestIdx)
  }
  return ordered
}

function snakeBuckets(
  participantIds: string[],
  groupsCount: number
): string[][] {
  const buckets: string[][] = Array.from({ length: groupsCount }, () => [])
  for (let i = 0; i < participantIds.length; i++) {
    const row = Math.floor(i / groupsCount)
    const col = i % groupsCount
    const gi = row % 2 === 0 ? col : groupsCount - 1 - col
    buckets[gi].push(participantIds[i])
  }
  return buckets
}

function groupLetter(index: number): string {
  return String.fromCharCode('A'.charCodeAt(0) + index)
}

function interleaveGroupPairQueues(
  queues: [string, string][][],
  groupKeys: string[],
  groupNames: string[]
): { pairs: [string, string][]; meta: { groupKey: string; name: string }[] } {
  const meta: { groupKey: string; name: string }[] = []
  const pairs: [string, string][] = []
  const q = queues.map(x => [...x])
  while (q.some(c => c.length > 0)) {
    for (let g = 0; g < q.length; g++) {
      if (q[g].length > 0) {
        const pr = q[g].shift()!
        pairs.push(pr)
        meta.push({ groupKey: groupKeys[g], name: groupNames[g] })
      }
    }
  }
  return { pairs, meta }
}

export function upperStageForRound(
  roundIdx: number,
  totalUpperRounds: number
): MatchStage {
  const roundsLeft = totalUpperRounds - roundIdx
  if (roundsLeft <= 1) return 'final'
  if (roundsLeft === 2) return 'semi'
  if (roundsLeft === 3) return 'quarter'
  return 'eight'
}

export function loserStagesForUpperRounds(r: number): MatchStage[] {
  const out: MatchStage[] = []
  if (r >= 4) out.push('loser_eight')
  if (r >= 3) out.push('loser_quarter')
  if (r >= 2) out.push('loser_semi')
  out.push('loser_final')
  return out
}

type BracketMatchDef = {
  key: string
  bracket: TournamentBracket
  stage: MatchStage
  slot1: SlotDependency | null
  slot2: SlotDependency | null
  user1: string | null
  user2: string | null
}

function buildSingleElimBracket(
  seedOrder: string[],
  groupKeyByUser: Map<string, string>,
  rankInGroup: Map<string, number>,
  matchKey: (k: string) => string
): BracketMatchDef[] {
  const ubRounds = Math.ceil(Math.log2(seedOrder.length))
  type Side = { t: 'user'; userId: string } | { t: 'win'; matchKey: string }
  let layer: Side[] = seedOrder.map(userId => ({ t: 'user', userId }))
  const out: BracketMatchDef[] = []
  for (let roundIdx = 0; layer.length > 1; roundIdx++) {
    const stage = upperStageForRound(roundIdx, ubRounds)
    const next: Side[] = []
    const half = layer.length / 2
    for (let i = 0; i < half; i++) {
      const left = layer[i]
      const right = layer[layer.length - 1 - i]
      const mKey = matchKey(`ub-r${roundIdx}-i${i}`)
      let slot1: SlotDependency | null = null
      let slot2: SlotDependency | null = null
      let user1: string | null = null
      let user2: string | null = null
      if (left.t === 'user') {
        user1 = left.userId
        slot1 = {
          kind: 'group_rank',
          groupId: groupKeyByUser.get(left.userId)!,
          rank: rankInGroup.get(left.userId)!,
        }
      } else {
        slot1 = { kind: 'match_winner', matchId: left.matchKey }
      }
      if (right.t === 'user') {
        user2 = right.userId
        slot2 = {
          kind: 'group_rank',
          groupId: groupKeyByUser.get(right.userId)!,
          rank: rankInGroup.get(right.userId)!,
        }
      } else {
        slot2 = { kind: 'match_winner', matchId: right.matchKey }
      }
      out.push({
        key: mKey,
        bracket: 'upper',
        stage,
        slot1,
        slot2,
        user1,
        user2,
      })
      next.push({ t: 'win', matchKey: mKey })
    }
    layer = next
  }
  return out
}

function buildSeedOrderAndMaps(
  groups: DraftGroup[],
  advancementCount: number,
  qualificationRank: Map<string, number>
): {
  seedOrder: string[]
  groupKeyByUser: Map<string, string>
  rankInGroup: Map<string, number>
} {
  const sortedGroups = groups.map(g => ({
    key: g.key,
    sorted: [...g.memberUserIds].sort(
      (a, b) =>
        (qualificationRank.get(a) ?? 1e9) - (qualificationRank.get(b) ?? 1e9)
    ),
  }))
  const seedOrder: string[] = []
  for (let r = 0; r < advancementCount; r++) {
    for (const g of sortedGroups) {
      seedOrder.push(g.sorted[r])
    }
  }
  const groupKeyByUser = new Map<string, string>()
  const rankInGroup = new Map<string, number>()
  for (const g of sortedGroups) {
    g.sorted.forEach((uid, idx) => {
      groupKeyByUser.set(uid, g.key)
      rankInGroup.set(uid, idx + 1)
    })
  }
  return { seedOrder, groupKeyByUser, rankInGroup }
}

function buildDoubleElimFour(
  seedOrder: string[],
  groupKeyByUser: Map<string, string>,
  rankInGroup: Map<string, number>,
  mk: (s: string) => string
): BracketMatchDef[] {
  const [s0, s1, s2, s3] = seedOrder
  const m0 = mk('de4-ub0-0')
  const m1 = mk('de4-ub0-1')
  const m2 = mk('de4-ub1-0')
  const m3 = mk('de4-lb0-0')
  const m4 = mk('de4-lb1-0')
  const m5 = mk('de4-gf')
  return [
    {
      key: m0,
      bracket: 'upper',
      stage: 'semi',
      user1: s0,
      user2: s3,
      slot1: {
        kind: 'group_rank',
        groupId: groupKeyByUser.get(s0)!,
        rank: rankInGroup.get(s0)!,
      },
      slot2: {
        kind: 'group_rank',
        groupId: groupKeyByUser.get(s3)!,
        rank: rankInGroup.get(s3)!,
      },
    },
    {
      key: m1,
      bracket: 'upper',
      stage: 'semi',
      user1: s1,
      user2: s2,
      slot1: {
        kind: 'group_rank',
        groupId: groupKeyByUser.get(s1)!,
        rank: rankInGroup.get(s1)!,
      },
      slot2: {
        kind: 'group_rank',
        groupId: groupKeyByUser.get(s2)!,
        rank: rankInGroup.get(s2)!,
      },
    },
    {
      key: m3,
      bracket: 'lower',
      stage: 'loser_semi',
      user1: null,
      user2: null,
      slot1: { kind: 'match_loser', matchId: m0 },
      slot2: { kind: 'match_loser', matchId: m1 },
    },
    {
      key: m2,
      bracket: 'upper',
      stage: 'final',
      user1: null,
      user2: null,
      slot1: { kind: 'match_winner', matchId: m0 },
      slot2: { kind: 'match_winner', matchId: m1 },
    },
    {
      key: m4,
      bracket: 'lower',
      stage: 'loser_final',
      user1: null,
      user2: null,
      slot1: { kind: 'match_winner', matchId: m3 },
      slot2: { kind: 'match_loser', matchId: m2 },
    },
    {
      key: m5,
      bracket: 'upper',
      stage: 'grand_final',
      user1: null,
      user2: null,
      slot1: { kind: 'match_winner', matchId: m2 },
      slot2: { kind: 'match_winner', matchId: m4 },
    },
  ]
}

function buildDoubleElimEight(
  seedOrder: string[],
  groupKeyByUser: Map<string, string>,
  rankInGroup: Map<string, number>,
  mk: (s: string) => string
): BracketMatchDef[] {
  const s = seedOrder
  const m: Record<string, string> = {}
  const keys = [
    'ub00',
    'ub01',
    'ub02',
    'ub03',
    'ub10',
    'ub11',
    'ub20',
    'lb00',
    'lb01',
    'lb10',
    'lb11',
    'lb20',
    'lb30',
    'gf',
  ] as const
  for (const k of keys) {
    m[k] = mk(`de8-${k}`)
  }

  const grp = (u: string) => groupKeyByUser.get(u)!
  const rnk = (u: string) => rankInGroup.get(u)!

  return [
    {
      key: m.ub00,
      bracket: 'upper',
      stage: 'quarter',
      user1: s[0],
      user2: s[7],
      slot1: { kind: 'group_rank', groupId: grp(s[0]), rank: rnk(s[0]) },
      slot2: { kind: 'group_rank', groupId: grp(s[7]), rank: rnk(s[7]) },
    },
    {
      key: m.ub01,
      bracket: 'upper',
      stage: 'quarter',
      user1: s[1],
      user2: s[6],
      slot1: { kind: 'group_rank', groupId: grp(s[1]), rank: rnk(s[1]) },
      slot2: { kind: 'group_rank', groupId: grp(s[6]), rank: rnk(s[6]) },
    },
    {
      key: m.ub02,
      bracket: 'upper',
      stage: 'quarter',
      user1: s[2],
      user2: s[5],
      slot1: { kind: 'group_rank', groupId: grp(s[2]), rank: rnk(s[2]) },
      slot2: { kind: 'group_rank', groupId: grp(s[5]), rank: rnk(s[5]) },
    },
    {
      key: m.ub03,
      bracket: 'upper',
      stage: 'quarter',
      user1: s[3],
      user2: s[4],
      slot1: { kind: 'group_rank', groupId: grp(s[3]), rank: rnk(s[3]) },
      slot2: { kind: 'group_rank', groupId: grp(s[4]), rank: rnk(s[4]) },
    },
    {
      key: m.lb00,
      bracket: 'lower',
      stage: 'loser_quarter',
      user1: null,
      user2: null,
      slot1: { kind: 'match_loser', matchId: m.ub00 },
      slot2: { kind: 'match_loser', matchId: m.ub01 },
    },
    {
      key: m.lb01,
      bracket: 'lower',
      stage: 'loser_quarter',
      user1: null,
      user2: null,
      slot1: { kind: 'match_loser', matchId: m.ub02 },
      slot2: { kind: 'match_loser', matchId: m.ub03 },
    },
    {
      key: m.ub10,
      bracket: 'upper',
      stage: 'semi',
      user1: null,
      user2: null,
      slot1: { kind: 'match_winner', matchId: m.ub00 },
      slot2: { kind: 'match_winner', matchId: m.ub01 },
    },
    {
      key: m.ub11,
      bracket: 'upper',
      stage: 'semi',
      user1: null,
      user2: null,
      slot1: { kind: 'match_winner', matchId: m.ub02 },
      slot2: { kind: 'match_winner', matchId: m.ub03 },
    },
    {
      key: m.lb10,
      bracket: 'lower',
      stage: 'loser_semi',
      user1: null,
      user2: null,
      slot1: { kind: 'match_winner', matchId: m.lb00 },
      slot2: { kind: 'match_loser', matchId: m.ub10 },
    },
    {
      key: m.lb11,
      bracket: 'lower',
      stage: 'loser_semi',
      user1: null,
      user2: null,
      slot1: { kind: 'match_winner', matchId: m.lb01 },
      slot2: { kind: 'match_loser', matchId: m.ub11 },
    },
    {
      key: m.lb20,
      bracket: 'lower',
      stage: 'loser_semi',
      user1: null,
      user2: null,
      slot1: { kind: 'match_winner', matchId: m.lb10 },
      slot2: { kind: 'match_winner', matchId: m.lb11 },
    },
    {
      key: m.ub20,
      bracket: 'upper',
      stage: 'final',
      user1: null,
      user2: null,
      slot1: { kind: 'match_winner', matchId: m.ub10 },
      slot2: { kind: 'match_winner', matchId: m.ub11 },
    },
    {
      key: m.lb30,
      bracket: 'lower',
      stage: 'loser_final',
      user1: null,
      user2: null,
      slot1: { kind: 'match_winner', matchId: m.lb20 },
      slot2: { kind: 'match_loser', matchId: m.ub20 },
    },
    {
      key: m.gf,
      bracket: 'upper',
      stage: 'grand_final',
      user1: null,
      user2: null,
      slot1: { kind: 'match_winner', matchId: m.ub20 },
      slot2: { kind: 'match_winner', matchId: m.lb30 },
    },
  ]
}

function assignTracksToMatches(
  matches: DraftMatch[],
  stageTracks: TournamentStageTracksConfig
): void {
  const byStage = new Map<MatchStage, DraftMatch[]>()
  for (const m of matches) {
    const list = byStage.get(m.stage) ?? []
    list.push(m)
    byStage.set(m.stage, list)
  }
  for (const [stage, list] of byStage) {
    const ordered = list.toSorted((a, b) => a.sortOrder - b.sortOrder)
    const tracks = stageTracks[stage] ?? []
    const T = tracks.length
    for (let i = 0; i < ordered.length; i++) {
      ordered[i].trackId = T > 0 ? tracks[i % T]! : null
    }
  }
}

export function generateTournamentDraft(input: {
  orderedParticipantIds: string[]
  qualificationRank: Map<string, number>
  groupsCount: number
  advancementCount: number
  eliminationType: EliminationType
  stageTracks: TournamentStageTracksConfig
  matchKeyFactory: (hint: string) => string
  userLabel: (userId: string) => string
}): TournamentDraft {
  const {
    orderedParticipantIds,
    qualificationRank,
    groupsCount,
    advancementCount,
    eliminationType,
    stageTracks,
    matchKeyFactory,
    userLabel,
  } = input

  const buckets = snakeBuckets(orderedParticipantIds, groupsCount)
  const groups: DraftGroup[] = buckets.map((members, i) => ({
    key: matchKeyFactory(`group-${i}`),
    name: groupLetter(i),
    memberUserIds: members,
  }))

  const pairQueues = groups.map(g => orderRoundRobinPairs(g.memberUserIds))
  const { pairs, meta } = interleaveGroupPairQueues(
    pairQueues,
    groups.map(g => g.key),
    groups.map(g => g.name)
  )

  const draftMatches: DraftMatch[] = []
  let sortOrder = 0
  for (let i = 0; i < pairs.length; i++) {
    const [u1, u2] = pairs[i]
    const gn = meta[i].name
    draftMatches.push({
      key: matchKeyFactory(`grp-${sortOrder}`),
      name: `Gruppe ${gn} · ${userLabel(u1)} vs ${userLabel(u2)}`,
      bracket: 'group',
      stage: 'group',
      sortOrder: sortOrder++,
      user1: u1,
      user2: u2,
      slot1: null,
      slot2: null,
      trackId: null,
    })
  }

  const { seedOrder, groupKeyByUser, rankInGroup } = buildSeedOrderAndMaps(
    groups,
    advancementCount,
    qualificationRank
  )

  const totalAdv = groupsCount * advancementCount
  let bracketDefs: BracketMatchDef[] = []
  if (eliminationType === 'single') {
    bracketDefs = buildSingleElimBracket(
      seedOrder,
      groupKeyByUser,
      rankInGroup,
      matchKeyFactory
    )
  } else if (totalAdv === 4) {
    bracketDefs = buildDoubleElimFour(
      seedOrder,
      groupKeyByUser,
      rankInGroup,
      matchKeyFactory
    )
  } else if (totalAdv === 8) {
    bracketDefs = buildDoubleElimEight(
      seedOrder,
      groupKeyByUser,
      rankInGroup,
      matchKeyFactory
    )
  }

  for (const b of bracketDefs) {
    draftMatches.push({
      key: b.key,
      name: b.stage,
      bracket: b.bracket,
      stage: b.stage,
      sortOrder: sortOrder++,
      user1: b.user1,
      user2: b.user2,
      slot1: b.slot1,
      slot2: b.slot2,
      trackId: null,
    })
  }

  assignTracksToMatches(draftMatches, stageTracks)

  const usedStages = [...new Set(draftMatches.map(m => m.stage))]
  return { groups, matches: draftMatches, usedStages }
}
