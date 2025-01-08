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
  static async getAllFromSession(sessionId: string) {
    console.debug('Getting groups for session', sessionId)
    return await db
      .select()
      .from(groups)
      .where(and(isNull(groups.deletedAt), eq(groups.session, sessionId)))
      .orderBy(groups.name)
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

  static async getDetails(group: GroupSelect): Promise<Group> {
    return {
      ...group,
      users: await UserManager.getUsersFromGroup(group.id),
    }
  }
}
