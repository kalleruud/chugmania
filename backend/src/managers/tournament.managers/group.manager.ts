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
import { and, eq, getTableColumns, inArray, isNull } from 'drizzle-orm'

export default class GroupManager {
  static async get(groupId: string): Promise<GroupWithPlayers> {
    // TODO: Fetch players with stats, users sorted after wins/losses
  }

  static async getAll(tournamentId: string): Promise<GroupWithPlayers[]> {
    const groupIds = (
      await db.query.groups.findMany({
        columns: { id: true },
        where: eq(groups.id, tournamentId),
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
    // TODO: Fetch matches for a specific group
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
   * Get wins and losses for a group player by counting completed matches.
   * Returns stats computed from matches rather than stored values.
   */
  static async getGroupPlayerStats(
    _groupId: string,
    userId: string
  ): Promise<{ wins: number; losses: number; totalMatches: number }> {
    // Find all group stage matches for this group
    const groupStages = await db.query.stages.findMany({
      where: and(isNull(stages.bracket), isNull(stages.deletedAt)),
    })

    if (groupStages.length === 0) {
      return { wins: 0, losses: 0, totalMatches: 0 }
    }

    const stageIds = groupStages.map(s => s.id)
    const tmRows = await db.query.tournamentMatches.findMany({
      where: and(
        inArray(tournamentMatches.stage, stageIds),
        isNull(tournamentMatches.deletedAt)
      ),
    })

    const matchesInGroupStages = await db.query.matches.findMany({
      where: and(
        inArray(
          matches.tournamentMatch,
          tmRows.map(tm => tm.id)
        ),
        isNull(matches.deletedAt)
      ),
    })

    // Filter to matches involving this user in this group
    // Note: We need to identify which matches belong to which group
    // For now, we count all matches where the user participated
    let wins = 0
    let losses = 0
    let totalMatches = 0

    for (const match of matchesInGroupStages) {
      const isUserA = match.userA === userId
      const isUserB = match.userB === userId
      if (!isUserA && !isUserB) continue

      totalMatches++
      if (match.winner) {
        const userWon =
          (isUserA && match.winner === 'A') || (isUserB && match.winner === 'B')
        if (userWon) wins++
        else losses++
      }
    }

    return { wins, losses, totalMatches }
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
  private static snakeSeed<
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
