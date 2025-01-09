import { and, eq, isNull } from 'drizzle-orm'
import db from '../db'
import { groups, groupUsers } from '../db/schema'
import type { PublicUser } from './user.manager'
import UserManager from './user.manager'

type GroupSelect = typeof groups.$inferSelect
export type Group = GroupSelect & {
  users: PublicUser[]
}

export default class GroupManager {
  static readonly table = groups

  static async getAllFromSession(sessionId: string) {
    console.debug('Getting groups for session', sessionId)
    return Promise.all(
      (
        await db
          .select()
          .from(groups)
          .where(and(isNull(groups.deletedAt), eq(groups.session, sessionId)))
          .orderBy(groups.name)
      ).map(g => this.getDetails(g))
    )
  }

  static async create(sessionId: string, amount: number = 1) {
    console.debug('Creating group for session', sessionId)
    return await db
      .insert(groups)
      .values(
        Array.from({ length: amount }).map((_, i) => ({
          name: String.fromCharCode(65 + i).toUpperCase(),
          session: sessionId,
        }))
      )
      .returning()
  }

  static async delete(groupId: string) {
    console.debug('Deleting group', groupId)
    await db.update(groups).set({ deletedAt: new Date() }).where(eq(groups.id, groupId))
    await db.update(groupUsers).set({ deletedAt: new Date() }).where(eq(groupUsers.group, groupId))
  }

  static async deleteBySession(sessionId: string) {
    console.debug('Deleting groups for session', sessionId)
    const deletedGroups = await db
      .update(groups)
      .set({ deletedAt: new Date() })
      .where(eq(groups.session, sessionId))
      .returning()
    Promise.all(
      deletedGroups.map(g =>
        db.update(groupUsers).set({ deletedAt: new Date() }).where(eq(groupUsers.group, g.id))
      )
    )
  }

  static async addUser(groupId: string, playerId: string) {
    console.debug('Adding user to group', groupId)
    return (
      await db
        .insert(groupUsers)
        .values({
          user: playerId,
          group: groupId,
        })
        .returning()
    ).at(0)
  }

  static async addUsers(groupId: string, playerIds: string[]) {
    console.debug('Adding users to group', groupId)
    return await db.insert(groupUsers).values(playerIds.map(user => ({ user, group: groupId })))
  }

  static async removeUser(groupId: string, userId: string) {
    console.debug('Removing user from group', groupId)
    return await db
      .delete(groupUsers)
      .where(and(eq(groupUsers.group, groupId), eq(groupUsers.user, userId)))
      .returning()
  }

  static async getUsersFromGroup(groupId: string) {
    console.debug('Getting users from group', groupId)
    return (
      await db
        .select()
        .from(groupUsers)
        .innerJoin(UserManager.table, eq(groupUsers.group, UserManager.table.id))
        .where(and(isNull(groupUsers.deletedAt), eq(groupUsers.group, groupId)))
    ).map(gu => UserManager.getDetails(gu.users))
  }

  static async getUserGroup(sessionId: string, userId: string) {
    console.debug('Getting group for user', userId, 'in session', sessionId)
    const result = await db
      .select()
      .from(groupUsers)
      .innerJoin(
        groups,
        and(
          isNull(groups.deletedAt),
          eq(groups.session, sessionId),
          eq(groupUsers.group, groups.id)
        )
      )
      .where(and(isNull(groupUsers.deletedAt), eq(groupUsers.user, userId)))
    const group = result.at(0)
    if (!group) return undefined
    return this.getDetails(group.groups)
  }

  static async getDetails(group: GroupSelect): Promise<Group> {
    return {
      ...group,
      users: await UserManager.getUsersFromGroup(group.id),
    }
  }
}
