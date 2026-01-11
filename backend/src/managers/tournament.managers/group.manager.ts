import db from '@backend/database/database'
import {
  groupPlayers,
  groups,
  matches,
  stages,
  tournamentMatches,
} from '@backend/database/schema'
import type { Group, GroupPlayer } from '@common/models/tournament'
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import RatingManager from '../rating.manager'
import UserManager from '../user.manager'

export default class GroupManager {
  static async getAll(
    tournamentId: string
  ): ReturnType<typeof GroupManager.generateGroups> {
    const groupRows = await db.query.groups.findMany({
      where: and(eq(groups.tournament, tournamentId), isNull(groups.deletedAt)),
      orderBy: asc(groups.index),
    })

    const groupPlayerRows = await db.query.groupPlayers.findMany({
      where: and(
        inArray(
          groupPlayers.group,
          groupRows.map(g => g.id)
        ),
        isNull(groupPlayers.deletedAt)
      ),
      orderBy: desc(groupPlayers.seed),
    })

    return {
      groups: groupRows,
      groupPlayers: groupPlayerRows,
    }
  }

  static async generateGroups(
    tournamentId: string,
    groupsCount: number,
    playerIds: string[]
  ): Promise<{ groups: Group[]; groupPlayers: GroupPlayer[] }> {
    const generatedGroups: Group[] = Array.from(
      { length: groupsCount },
      (_, i) => ({
        id: randomUUID(),
        index: i,
        tournament: tournamentId,
        updatedAt: null,
        createdAt: new Date(),
        deletedAt: null,
      })
    )

    const playersWithSeed = await Promise.all(
      playerIds.map(async p => ({
        ...(await UserManager.getUserById(p)),
        seed:
          RatingManager.getUserRatings(p)?.totalRating ??
          Number.MAX_SAFE_INTEGER,
      }))
    )

    const generatedGroupPlayers: GroupPlayer[] = GroupManager.snakeSeed(
      playersWithSeed,
      generatedGroups
    ).map(gi => ({
      id: randomUUID(),
      group: gi.group,
      user: gi.item,
      seed: gi.seed,
      createdAt: new Date(),
      updatedAt: null,
      deletedAt: null,
    }))

    return {
      groups: generatedGroups,
      groupPlayers: generatedGroupPlayers,
    }
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
      where: and(eq(stages.bracket, 'group'), isNull(stages.deletedAt)),
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

    const matchIds = tmRows.map(tm => tm.match)
    const matchRows = await db.query.matches.findMany({
      where: and(inArray(matches.id, matchIds), isNull(matches.deletedAt)),
    })

    // Filter to matches involving this user in this group
    // Note: We need to identify which matches belong to which group
    // For now, we count all matches where the user participated
    let wins = 0
    let losses = 0
    let totalMatches = 0

    for (const match of matchRows) {
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
    // Get group players
    const gpRows = await db.query.groupPlayers.findMany({
      where: and(
        eq(groupPlayers.group, groupId),
        isNull(groupPlayers.deletedAt)
      ),
    })

    if (gpRows.length < 2) return true

    // Expected matches in round-robin = n*(n-1)/2
    const expectedMatches = (gpRows.length * (gpRows.length - 1)) / 2

    // Find group stage for this group's tournament
    const group = await db.query.groups.findFirst({
      where: eq(groups.id, groupId),
    })
    if (!group) return false

    const groupStageRows = await db.query.stages.findMany({
      where: and(
        eq(stages.tournament, group.tournament),
        eq(stages.bracket, 'group'),
        isNull(stages.deletedAt)
      ),
    })

    if (groupStageRows.length === 0) return false

    const stageIds = groupStageRows.map(s => s.id)

    // Get tournament matches for these stages
    const tmRows = await db.query.tournamentMatches.findMany({
      where: and(
        inArray(tournamentMatches.stage, stageIds),
        isNull(tournamentMatches.deletedAt)
      ),
    })

    const matchIds = tmRows.map(tm => tm.match)
    const matchRows = await db.query.matches.findMany({
      where: and(inArray(matches.id, matchIds), isNull(matches.deletedAt)),
    })

    // Count completed matches involving players from this group
    const groupUserIds = new Set(gpRows.map(gp => gp.user))
    let completedMatches = 0

    for (const match of matchRows) {
      if (
        match.userA &&
        match.userB &&
        groupUserIds.has(match.userA) &&
        groupUserIds.has(match.userB) &&
        match.winner
      ) {
        completedMatches++
      }
    }

    return completedMatches >= expectedMatches
  }

  /**
   * Get the user at a specific rank in a group.
   * Rank is 1-indexed (1 = first place).
   */
  static async getUserAt(groupId: string, rank: number): Promise<string> {
    // Get group players with their stats
    const gpRows = await db.query.groupPlayers.findMany({
      where: and(
        eq(groupPlayers.group, groupId),
        isNull(groupPlayers.deletedAt)
      ),
    })

    // Get all matches for this group to compute standings
    const group = await db.query.groups.findFirst({
      where: eq(groups.id, groupId),
    })
    if (!group) throw new Error(`Group ${groupId} not found`)

    const groupStageRows = await db.query.stages.findMany({
      where: and(
        eq(stages.tournament, group.tournament),
        eq(stages.bracket, 'group'),
        isNull(stages.deletedAt)
      ),
    })

    const stageIds = groupStageRows.map(s => s.id)
    const tmRows = await db.query.tournamentMatches.findMany({
      where: and(
        inArray(tournamentMatches.stage, stageIds),
        isNull(tournamentMatches.deletedAt)
      ),
    })

    const matchIds = tmRows.map(tm => tm.match)
    const matchRows = await db.query.matches.findMany({
      where: and(inArray(matches.id, matchIds), isNull(matches.deletedAt)),
    })

    // Compute wins for each group player
    const groupUserIds = new Set(gpRows.map(gp => gp.user))
    const winsMap = new Map<string, number>()

    for (const gp of gpRows) {
      winsMap.set(gp.user, 0)
    }

    for (const match of matchRows) {
      if (
        match.userA &&
        match.userB &&
        groupUserIds.has(match.userA) &&
        groupUserIds.has(match.userB) &&
        match.winner
      ) {
        const winnerId = match.winner === 'A' ? match.userA : match.userB
        winsMap.set(winnerId, (winsMap.get(winnerId) ?? 0) + 1)
      }
    }

    // Sort by wins descending, then by seed descending for tiebreaker
    const sortedPlayers = gpRows
      .map(gp => ({
        user: gp.user,
        wins: winsMap.get(gp.user) ?? 0,
        seed: gp.seed,
      }))
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins
        return b.seed - a.seed // Higher seed wins tiebreaker
      })

    if (rank < 1 || rank > sortedPlayers.length) {
      throw new Error(`Invalid rank ${rank} for group ${groupId}`)
    }

    return sortedPlayers[rank - 1].user
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
