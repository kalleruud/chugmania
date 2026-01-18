import loc from '@/lib/locales'
import db from '@backend/database/database'
import { groupPlayers, groups, matches, stages } from '@backend/database/schema'
import type {
  CreateGroupPlayer,
  Group,
  GroupPlayerWithStats,
  GroupWithPlayers,
  MatchWithTournamentDetails,
} from '@common/models/tournament'
import type { UserInfoWithSeed } from '@common/models/user'
import { and, eq, getTableColumns } from 'drizzle-orm'

export default class GroupManager {
  static async get(groupId: string): Promise<GroupWithPlayers> {
    const group = await GroupManager.getGroup(groupId)
    const groupPlayersData = await db.query.groupPlayers.findMany({
      where: eq(groupPlayers.group, groupId),
    })
    const matches = await GroupManager.getGroupMatches(groupId)

    const playerStats = GroupManager.calculatePlayerStats(
      groupPlayersData,
      matches
    )
    const sortedPlayers = GroupManager.sortPlayersByStats(
      groupPlayersData,
      playerStats
    )

    return {
      ...group,
      players: sortedPlayers,
    }
  }

  private static calculatePlayerStats(
    players: (typeof groupPlayers.$inferSelect)[],
    matches: MatchWithTournamentDetails[]
  ): Map<string, { wins: number; losses: number }> {
    const playerStats = new Map<string, { wins: number; losses: number }>()

    // Initialize stats
    for (const player of players) {
      playerStats.set(player.user, { wins: 0, losses: 0 })
    }

    // Count wins and losses from completed matches
    for (const match of matches) {
      if (match.status !== 'completed' || !match.winner) continue

      const winnerUserId = match.winner === 'A' ? match.userA : match.userB
      const loserUserId = match.winner === 'A' ? match.userB : match.userA

      if (winnerUserId && playerStats.has(winnerUserId)) {
        playerStats.get(winnerUserId)!.wins++
      }
      if (loserUserId && playerStats.has(loserUserId)) {
        playerStats.get(loserUserId)!.losses++
      }
    }

    return playerStats
  }

  private static sortPlayersByStats(
    players: (typeof groupPlayers.$inferSelect)[],
    playerStats: Map<string, { wins: number; losses: number }>
  ): GroupPlayerWithStats[] {
    return players
      .map(player => ({
        ...player,
        wins: playerStats.get(player.user)?.wins ?? 0,
        losses: playerStats.get(player.user)?.losses ?? 0,
      }))
      .toSorted((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins
        return a.losses - b.losses
      })
  }

  static async getAll(tournamentId: string): Promise<GroupWithPlayers[]> {
    const groupIds = (
      await db.query.groups.findMany({
        columns: { id: true },
        where: eq(groups.tournament, tournamentId),
      })
    ).map(g => g.id)

    return await Promise.all(groupIds.map(GroupManager.get))
  }

  static async getUsersGroup(
    tournamentId: string,
    userId: string
  ): Promise<Group> {
    const [group] = await db
      .select(getTableColumns(groups))
      .from(groups)
      .leftJoin(groupPlayers, eq(groupPlayers.group, groups.id))
      .where(
        and(eq(groups.tournament, tournamentId), eq(groupPlayers.user, userId))
      )

    if (!group) {
      throw new Error(
        `User '${userId}' not found in any groups in tournament '${tournamentId}'`
      )
    }
    return group
  }

  static async getGroupMatches(
    groupId: string
  ): Promise<MatchWithTournamentDetails[]> {
    // Get the group to access tournament id
    const group = await GroupManager.getGroup(groupId)

    // Fetch all matches for the group stage (stage.level = 'group')
    const matchesData = await db
      .select()
      .from(matches)
      .innerJoin(stages, eq(matches.stage, stages.id))
      .where(
        and(eq(stages.tournament, group.tournament), eq(stages.level, 'group'))
      )

    return matchesData.map(({ matches: match, stages: stage }) => ({
      ...match,
      stage: stage.id,
      index: match.index ?? 0,
      dependencyNames: null,
    }))
  }

  private static async getGroup(groupId: string): Promise<Group> {
    const group = await db.query.groups.findFirst({
      where: eq(groups.id, groupId),
    })
    if (!group) throw new Error(loc.no.error.messages.not_in_db(groupId))
    return group
  }

  static async generateGroups(
    tournamentId: string,
    groupsCount: number,
    participants: UserInfoWithSeed[]
  ): Promise<GroupWithPlayers[]> {
    const createdGroups = await db
      .insert(groups)
      .values(
        Array.from({ length: groupsCount }, (_, index) => ({
          index,
          tournament: tournamentId,
        }))
      )
      .returning()

    const generatedGroupPlayers = GroupManager.snakeSeed(
      participants,
      createdGroups
    ).map(
      gi =>
        ({
          group: gi.group,
          user: gi.item,
          seed: gi.seed,
        }) satisfies CreateGroupPlayer
    )

    const createdGroupPlayers = await db
      .insert(groupPlayers)
      .values(generatedGroupPlayers)
      .returning()

    return createdGroups.map(g => ({
      ...g,
      players: createdGroupPlayers
        .filter(gp => gp.group === g.id)
        .map(gp => ({
          ...gp,
          wins: 0,
          losses: 0,
        })),
    }))
  }

  /**
   * Check if all matches in a group are complete by querying matches.
   */
  static async isGroupComplete(groupId: string): Promise<boolean> {
    const matches = await GroupManager.getGroupMatches(groupId)
    if (matches.length === 0)
      throw new Error(
        'Tried to check if group is complete, but found no matches'
      )
    return matches.every(m => m.status === 'completed')
  }

  /**
   * Get the user at a specific rank in a group.
   * Only returns users if their final position is determined
   * Rank is 0-indexed (0 = first place).
   */
  static async getUserAt(
    groupId: string,
    rank: number
  ): Promise<GroupPlayerWithStats> {
    const groupWithPlayers = await GroupManager.get(groupId)
    return groupWithPlayers.players[rank]
  }

  /**
   * Snake seeds items into groups in a snake-like pattern.
   * Row 0: A B C D (left to right)
   * Row 1: D C B A (right to left)
   * Row 2: A B C D (left to right)
   * etc.
   * @param items - The items to seed.
   * @param groups - The groups to seed into.
   * @returns The group items.
   */
  static snakeSeed<
    T extends { id: string },
    G extends { id: string; index: number },
  >(
    items: (T & { seed: number })[],
    groups: G[]
  ): {
    group: G['id']
    item: T['id']
    seed: number
  }[] {
    const sortedItems = items.toSorted((a, b) => b.seed - a.seed)
    const sortedGroups = groups.toSorted((a, b) => a.index - b.index)

    const groupItems: {
      group: G['id']
      item: T['id']
      seed: number
    }[] = []
    for (let i = 0; i < sortedItems.length; i++) {
      const row = Math.floor(i / sortedGroups.length)
      const positionInRow = i % sortedGroups.length
      const isReverseRow = row % 2 === 1

      const groupIndex = isReverseRow
        ? groups.length - 1 - positionInRow
        : positionInRow
      const group = groups[groupIndex]

      groupItems.push({
        group: group.id,
        item: sortedItems[i].id,
        seed: sortedItems[i].seed,
      })
    }

    return groupItems
  }
}
