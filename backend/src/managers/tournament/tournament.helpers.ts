import type {
  MatchStage,
  TournamentBracket,
} from '../../../database/schema'
import type {
  TournamentGroup,
  TournamentMatchRecord,
  TournamentParticipantRanking,
  TournamentSlotDependency,
  TournamentStanding,
} from '@common/models/tournament'
import type { Match } from '@common/models/match'
import type { UserInfo } from '@common/models/user'

export type DraftGroup = {
  id: TournamentGroup['id']
  name: TournamentGroup['name']
  players: TournamentParticipantRanking[]
}

export type DraftTournamentMatch = {
  id: TournamentMatchRecord['id']
  matchId: Match['id']
  name: string
  bracket: TournamentBracket
  round: number
  sortOrder: number
  groupId: TournamentGroup['id'] | null
  trackId: Match['track']
  stage: MatchStage | null
  slotA: TournamentSlotDependency | null
  slotB: TournamentSlotDependency | null
  user1: UserInfo['id'] | null
  user2: UserInfo['id'] | null
}

type MatchResolutionSource = Pick<
  TournamentMatchRecord,
  | 'id'
  | 'name'
  | 'bracket'
  | 'sourceGroupA'
  | 'sourceGroupARank'
  | 'sourceGroupB'
  | 'sourceGroupBRank'
  | 'sourceMatchA'
  | 'sourceMatchAProgression'
  | 'sourceMatchB'
  | 'sourceMatchBProgression'
  | 'sortOrder'
> & {
  match: Pick<Match, 'id' | 'user1' | 'user2' | 'winner' | 'status'>
}

export function getGroupName(index: number): string {
  let value = index + 1
  let name = ''

  while (value > 0) {
    const remainder = (value - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    value = Math.floor((value - 1) / 26)
  }

  return name
}

export function isPowerOfTwo(value: number): boolean {
  return value > 0 && (value & (value - 1)) === 0
}

export function rankParticipantsByQualification(
  participants: TournamentParticipantRanking[]
): TournamentParticipantRanking[] {
  return [...participants]
    .sort((left, right) => {
      if (
        left.qualificationDuration !== null &&
        right.qualificationDuration !== null &&
        left.qualificationDuration !== right.qualificationDuration
      ) {
        return left.qualificationDuration - right.qualificationDuration
      }

      if (
        left.qualificationDuration !== null &&
        right.qualificationDuration === null
      ) {
        return -1
      }

      if (
        left.qualificationDuration === null &&
        right.qualificationDuration !== null
      ) {
        return 1
      }

      const leftRanking = left.globalRanking ?? Number.MAX_SAFE_INTEGER
      const rightRanking = right.globalRanking ?? Number.MAX_SAFE_INTEGER
      if (leftRanking !== rightRanking) {
        return leftRanking - rightRanking
      }

      return left.user.id.localeCompare(right.user.id)
    })
    .map((participant, index) => ({
      ...participant,
      qualificationRank: index + 1,
    }))
}

export function assignParticipantsToGroupsSnake(
  participants: TournamentParticipantRanking[],
  groupsCount: number,
  createId: () => string
): DraftGroup[] {
  const groups = Array.from({ length: groupsCount }, (_, index) => ({
    id: createId(),
    name: getGroupName(index),
    players: [] as TournamentParticipantRanking[],
  }))

  for (let index = 0; index < participants.length; index += 1) {
    const groupIndex = index % groupsCount
    const cycle = Math.floor(index / groupsCount)
    const targetIndex = cycle % 2 === 0 ? groupIndex : groupsCount - 1 - groupIndex
    groups[targetIndex].players.push(participants[index])
  }

  return groups
}

export function createRoundRobinGroupMatches(
  groups: DraftGroup[],
  trackId: string,
  createId: () => string
): DraftTournamentMatch[] {
  const matches: DraftTournamentMatch[] = []
  let sortOrder = 0

  for (const group of groups) {
    let groupMatchNumber = 1

    for (let leftIndex = 0; leftIndex < group.players.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < group.players.length;
        rightIndex += 1
      ) {
        const left = group.players[leftIndex]
        const right = group.players[rightIndex]

        matches.push({
          id: createId(),
          matchId: createId(),
          name: `Group ${group.name} Match ${groupMatchNumber}`,
          bracket: 'group',
          round: 1,
          sortOrder,
          groupId: group.id,
          trackId,
          stage: 'group',
          slotA: null,
          slotB: null,
          user1: left.user.id,
          user2: right.user.id,
        })

        sortOrder += 1
        groupMatchNumber += 1
      }
    }
  }

  return matches
}

function buildSeedPositions(size: number): number[] {
  let positions = [1, 2]

  while (positions.length < size) {
    const nextSize = positions.length * 2 + 1
    const nextPositions: number[] = []

    for (const seed of positions) {
      nextPositions.push(seed, nextSize - seed)
    }

    positions = nextPositions
  }

  return positions
}

function getBracketStage(
  entrantsInRound: number
): MatchStage | null {
  if (entrantsInRound === 16) return 'eight'
  if (entrantsInRound === 8) return 'quarter'
  if (entrantsInRound === 4) return 'semi'
  if (entrantsInRound === 2) return 'final'
  return null
}

function getBracketMatchName(
  entrantsInRound: number,
  roundNumber: number,
  matchNumber: number
): string {
  const stage = getBracketStage(entrantsInRound)

  if (stage === 'eight') return `Round of 16 Match ${matchNumber}`
  if (stage === 'quarter') return `Quarterfinal ${matchNumber}`
  if (stage === 'semi') return `Semifinal ${matchNumber}`
  if (stage === 'final') return `Final`

  return `Upper Round ${roundNumber} Match ${matchNumber}`
}

export function createSingleEliminationBracket(
  groups: DraftGroup[],
  advancementCount: number,
  trackId: string,
  createId: () => string
): DraftTournamentMatch[] {
  const seededEntries = groups.flatMap(group =>
    Array.from({ length: advancementCount }, (_, index) => ({
      groupId: group.id,
      groupName: group.name,
      rank: index + 1,
    }))
  )

  const positions = buildSeedPositions(seededEntries.length)
  const firstRoundEntries = positions.map(seed => seededEntries[seed - 1] ?? null)
  const rounds = Math.log2(seededEntries.length)
  const matches: DraftTournamentMatch[] = []
  let currentRoundSource = [] as DraftTournamentMatch[]
  let sortOrder = 10_000

  for (let roundIndex = 0; roundIndex < rounds; roundIndex += 1) {
    const entrantsInRound = seededEntries.length / 2 ** roundIndex
    const matchesInRound = entrantsInRound / 2
    const nextRound: DraftTournamentMatch[] = []

    for (let matchIndex = 0; matchIndex < matchesInRound; matchIndex += 1) {
      const id = createId()
      const slotA =
        roundIndex === 0
          ? firstRoundEntries[matchIndex * 2]
          : currentRoundSource[matchIndex * 2]
      const slotB =
        roundIndex === 0
          ? firstRoundEntries[matchIndex * 2 + 1]
          : currentRoundSource[matchIndex * 2 + 1]

      const tournamentMatch: DraftTournamentMatch = {
        id,
        matchId: createId(),
        name: getBracketMatchName(entrantsInRound, roundIndex + 1, matchIndex + 1),
        bracket: 'upper',
        round: roundIndex + 1,
        sortOrder,
        groupId: null,
        trackId,
        stage: getBracketStage(entrantsInRound),
        slotA:
          roundIndex === 0 && slotA
            ? {
                type: 'group_rank',
                groupId: slotA.groupId,
                groupName: slotA.groupName,
                rank: slotA.rank,
              }
            : slotA
              ? {
                  type: 'match_winner',
                  tournamentMatchId: slotA.id,
                  matchName: slotA.name,
                }
              : null,
        slotB:
          roundIndex === 0 && slotB
            ? {
                type: 'group_rank',
                groupId: slotB.groupId,
                groupName: slotB.groupName,
                rank: slotB.rank,
              }
            : slotB
              ? {
                  type: 'match_winner',
                  tournamentMatchId: slotB.id,
                  matchName: slotB.name,
                }
              : null,
        user1: null,
        user2: null,
      }

      matches.push(tournamentMatch)
      nextRound.push(tournamentMatch)
      sortOrder += 1
    }

    currentRoundSource = nextRound
  }

  return matches
}

export function buildGroupStandings(
  group: DraftGroup,
  matches: Array<Pick<Match, 'user1' | 'user2' | 'winner' | 'status'>>
): TournamentStanding[] {
  const records = new Map(
    group.players.map(player => [
      player.user.id,
      {
        user: player.user,
        qualificationRank: player.qualificationRank,
        wins: 0,
        losses: 0,
        matchesPlayed: 0,
        advanced: false,
      },
    ])
  )

  for (const match of matches) {
    if (
      match.status !== 'completed' ||
      !match.user1 ||
      !match.user2 ||
      !match.winner
    ) {
      continue
    }

    const winner = records.get(match.winner)
    const loserId = match.winner === match.user1 ? match.user2 : match.user1
    const loser = records.get(loserId)

    if (!winner || !loser) {
      continue
    }

    winner.wins += 1
    winner.matchesPlayed += 1
    loser.losses += 1
    loser.matchesPlayed += 1
  }

  return [...records.values()].sort((left, right) => {
    if (left.wins !== right.wins) {
      return right.wins - left.wins
    }

    if (left.losses !== right.losses) {
      return left.losses - right.losses
    }

    if (left.qualificationRank !== right.qualificationRank) {
      return left.qualificationRank - right.qualificationRank
    }

    return left.user.id.localeCompare(right.user.id)
  })
}

export function getSlotDependency(
  match: Pick<
    TournamentMatchRecord,
    | 'sourceGroupA'
    | 'sourceGroupARank'
    | 'sourceGroupB'
    | 'sourceGroupBRank'
    | 'sourceMatchA'
    | 'sourceMatchAProgression'
    | 'sourceMatchB'
    | 'sourceMatchBProgression'
  >,
  side: 'A' | 'B',
  groupsById: Map<string, Pick<TournamentGroup, 'id' | 'name'>>,
  matchesById: Map<string, Pick<TournamentMatchRecord, 'id' | 'name'>>
): TournamentSlotDependency | null {
  const groupId = side === 'A' ? match.sourceGroupA : match.sourceGroupB
  const groupRank = side === 'A' ? match.sourceGroupARank : match.sourceGroupBRank
  if (groupId && groupRank) {
    const group = groupsById.get(groupId)
    if (!group) return null

    return {
      type: 'group_rank',
      groupId: group.id,
      groupName: group.name,
      rank: groupRank,
    }
  }

  const sourceMatchId = side === 'A' ? match.sourceMatchA : match.sourceMatchB
  const progression =
    side === 'A' ? match.sourceMatchAProgression : match.sourceMatchBProgression

  if (sourceMatchId && progression === 'winner') {
    const sourceMatch = matchesById.get(sourceMatchId)
    if (!sourceMatch) return null

    return {
      type: 'match_winner',
      tournamentMatchId: sourceMatch.id,
      matchName: sourceMatch.name,
    }
  }

  return null
}

export function resolveMatchParticipants(
  matches: MatchResolutionSource[],
  standingsByGroupId: Map<string, TournamentStanding[]>
): Array<{
  tournamentMatchId: string
  matchId: string
  user1: string | null
  user2: string | null
}> {
  const winners = new Map<string, string | null>(
    matches.map(match => [
      match.id,
      match.match.status === 'completed' ? (match.match.winner ?? null) : null,
    ])
  )

  const resolvedUsers = new Map(
    matches.map(match => [
      match.id,
      {
        tournamentMatchId: match.id,
        matchId: match.match.id,
        user1: match.match.user1 ?? null,
        user2: match.match.user2 ?? null,
      },
    ])
  )

  let changed = true
  while (changed) {
    changed = false

    for (const match of [...matches].sort((left, right) => left.sortOrder - right.sortOrder)) {
      if (match.bracket === 'group') {
        continue
      }

      const nextUser1 = resolveSlotUserId(
        {
          sourceGroup: match.sourceGroupA,
          sourceGroupRank: match.sourceGroupARank,
          sourceMatch: match.sourceMatchA,
          sourceMatchProgression: match.sourceMatchAProgression,
        },
        standingsByGroupId,
        winners
      )
      const nextUser2 = resolveSlotUserId(
        {
          sourceGroup: match.sourceGroupB,
          sourceGroupRank: match.sourceGroupBRank,
          sourceMatch: match.sourceMatchB,
          sourceMatchProgression: match.sourceMatchBProgression,
        },
        standingsByGroupId,
        winners
      )
      const current = resolvedUsers.get(match.id)
      if (!current) {
        continue
      }

      if (current.user1 !== nextUser1 || current.user2 !== nextUser2) {
        current.user1 = nextUser1
        current.user2 = nextUser2
        changed = true
      }
    }
  }

  return [...resolvedUsers.values()]
}

function resolveSlotUserId(
  source: {
    sourceGroup: string | null
    sourceGroupRank: number | null
    sourceMatch: string | null
    sourceMatchProgression: string | null
  },
  standingsByGroupId: Map<string, TournamentStanding[]>,
  winners: Map<string, string | null>
): string | null {
  if (source.sourceGroup && source.sourceGroupRank) {
    const standings = standingsByGroupId.get(source.sourceGroup)
    return standings?.[source.sourceGroupRank - 1]?.user.id ?? null
  }

  if (source.sourceMatch && source.sourceMatchProgression === 'winner') {
    return winners.get(source.sourceMatch) ?? null
  }

  return null
}

export function getSlotLabel(
  dependency: TournamentSlotDependency | null,
  participantsById: Map<string, TournamentParticipantRanking>,
  resolvedUserId: string | null
): {
  userId: string | null
  label: string
} {
  if (resolvedUserId) {
    const participant = participantsById.get(resolvedUserId)
    const shortName = participant?.user.shortName?.trim()
    const label =
      shortName && shortName.length > 0
        ? shortName
        : [participant?.user.firstName, participant?.user.lastName]
            .filter(Boolean)
            .join(' ')
            .trim() || resolvedUserId

    return {
      userId: resolvedUserId,
      label,
    }
  }

  if (!dependency) {
    return {
      userId: null,
      label: 'TBD',
    }
  }

  if (dependency.type === 'group_rank') {
    return {
      userId: null,
      label: `${dependency.groupName}${dependency.rank}`,
    }
  }

  return {
    userId: null,
    label: `Winner ${dependency.matchName}`,
  }
}
