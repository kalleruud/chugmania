import { and, eq, isNull } from 'drizzle-orm'
import db from '../db'
import { groups, groupUsers } from '../db/schema'

export type Group = typeof groups.$inferSelect

export default class GroupManager {
  static async getAllFromSession(sessionId: string) {
    console.debug('Getting groups for session', sessionId)
    return await db
      .select()
      .from(groups)
      .where(and(isNull(groups.deletedAt), eq(groups.session, sessionId)))
      .orderBy(groups.name)
  }

  static async create(sessionId: string, name?: string) {
    console.debug('Creating group for session', sessionId)
    const existingGroupCount = (await this.getAllFromSession(sessionId)).length
    return await db.insert(groups).values({
      name: name ?? String.fromCharCode(97 + existingGroupCount).toUpperCase(),
      session: sessionId,
    })
  }

  static async delete(groupId: string) {
    console.debug('Deleting group', groupId)
    return await db.update(groups).set({ deletedAt: new Date() }).where(eq(groups.id, groupId))
  }

  static async getUsers(groupId: string) {
    console.debug('Getting users for group', groupId)
    return await db
      .select()
      .from(groupUsers)
      .where(and(isNull(groupUsers.deletedAt), eq(groupUsers.group, groupId)))
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

  static async removeUser(groupId: string, userId: string) {
    console.debug('Removing user from group', groupId)
    return await db
      .delete(groupUsers)
      .where(and(eq(groupUsers.group, groupId), eq(groupUsers.user, userId)))
      .returning()
  }
}
