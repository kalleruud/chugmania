import loc from '@/lib/locales'
import db from '@backend/database/database'
import { groupPlayers, groups } from '@backend/database/schema'
import type { Match } from '@common/models/match'
import type { Group, GroupPlayer } from '@common/models/tournament'
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import RatingManager from '../rating.manager'
import UserManager from '../user.manager'

export default class GroupManager {
  static async getAll(
    tournamentId: string
  ): ReturnType<typeof GroupManager.generateGroups> {
    const groupRows = await db.query.groups.findMany({
      where: and(eq(groups.tournament, tournamentId), isNull(groups.deletedAt)),
      orderBy: asc(groups.number),
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
    const groups = Array.from(
      { length: groupsCount },
      (_, i) =>
        ({
          id: randomUUID(),
          number: i + 1,
          tournament: tournamentId,
          updatedAt: null,
          createdAt: new Date(),
          deletedAt: null,
        }) satisfies Group
    )

    const playersWithSeed = await Promise.all(
      playerIds.map(async p => ({
        ...(await UserManager.getUserById(p)),
        seed:
          RatingManager.getUserRatings(p)?.totalRating ??
          Number.MAX_SAFE_INTEGER,
      }))
    )

    const groupPlayers = GroupManager.snakeSeed(playersWithSeed, groups).map(
      gi =>
        ({
          id: randomUUID(),
          group: gi.group,
          user: gi.item,
          seed: gi.seed,
          totalMatches: gi.totalMatches[gi.group],
          wins: 0,
          losses: 0,
          createdAt: new Date(),
          updatedAt: null,
          deletedAt: null,
        }) satisfies GroupPlayer
    )

    return {
      groups,
      groupPlayers,
    }
  }

  static async incrementGroupWinLoseStats(
    group: string,
    match: Match & { winner: string }
  ) {
    await db
      .update(groupPlayers)
      .set({
        wins: sql`${groupPlayers.wins} + 1`,
      })
      .where(
        and(eq(groupPlayers.group, group), eq(groupPlayers.user, match.winner))
      )

    const loser = match.user1 === match.winner ? match.user2 : match.user1
    if (!loser) throw new Error(loc.no.error.messages.loser_not_found)

    await db
      .update(groupPlayers)
      .set({
        losses: sql`${groupPlayers.losses} + 1`,
      })
      .where(and(eq(groupPlayers.group, group), eq(groupPlayers.user, loser)))

    return await GroupManager.isGroupComplete(group)
  }

  private static async isGroupComplete(groupId: string): Promise<boolean> {
    const groupPlayerRows = await db.query.groupPlayers.findMany({
      where: eq(groupPlayers.group, groupId),
    })
    return groupPlayerRows.every(gp => gp.wins + gp.losses === gp.totalMatches)
  }

  static async getUserAt(groupId: string, rank: number) {
    // TODO: Implement tie-breaker logic
    const groupPlayerRows = await db
      .select({ userId: groupPlayers.user })
      .from(groupPlayers)
      .where(eq(groupPlayers.group, groupId))
      .orderBy(asc(groupPlayers.wins), desc(groupPlayers.losses))
      .offset(rank - 1)
      .limit(1)

    if (!groupPlayerRows.length) {
      throw new Error(`User not found at rank ${rank} in group ${groupId}`)
    }

    return groupPlayerRows[0].userId
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
    G extends { id: string; number: number },
  >(
    items: (T & { seed: number })[],
    groups: G[]
  ): {
    group: G['id']
    item: T['id']
    seed: number
    totalMatches: Record<G['id'], number>
  }[] {
    const sortedItems = items.toSorted((a, b) => b.seed - a.seed)
    const sortedGroups = groups.toSorted((a, b) => a.number - b.number)

    const groupItems: {
      group: G['id']
      item: T['id']
      seed: number
      totalMatches: Record<G['id'], number>
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
        totalMatches: groupItems.reduce(
          (acc, item) => ({
            ...acc,
            [item.group]: item.totalMatches[item.group] + 1,
          }),
          {} as Record<G['id'], number>
        ),
      })
    }

    return groupItems
  }
}
