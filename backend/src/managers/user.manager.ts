import { eq } from 'drizzle-orm'
import type {
  BackendResponse,
  GetUsersResponse,
} from '../../../common/models/responses'
import {
  WS_BROADCAST_USERS,
  type User,
  type UserInfo,
} from '../../../common/models/user'
import { tryCatchAsync } from '../../../common/utils/try-catch'
import db from '../../database/database'
import { users } from '../../database/schema'
import ConnectionManager from './connection.manager'

export default class UserManager {
  static readonly table = users

  static async getUser(email: string) {
    const { data: user, error } = await tryCatchAsync(
      db.query.users.findFirst({ where: eq(users.email, email) })
    )

    if (error) throw error
    if (!user) throw new Error(`Couldn't find user with email ${email}`)

    return user
  }

  static async createUser(userData: typeof users.$inferInsert) {
    const { data: user, error } = await tryCatchAsync(
      db.insert(users).values(userData).returning()
    )

    if (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        error.message = 'Email alreadt registered'
      }
      throw error
    }

    if (user.length != 1)
      throw new Error('Unknown error: Failed to create user')
    return user[0]!
  }

  static async getUserById(id: User['id']) {
    const { data: user, error } = await tryCatchAsync(
      db.query.users.findFirst({ where: eq(users.id, id) })
    )

    if (error) throw error
    if (!user) throw new Error(`Couldn't find user with id ${id}`)

    return user
  }

  static async updateUser(
    id: User['id'],
    updates: Partial<typeof users.$inferInsert>
  ): Promise<User> {
    const entries = Object.entries(updates).filter(
      ([, value]) => value !== undefined
    )

    if (entries.length === 0) return UserManager.getUserById(id)

    const { data, error } = await tryCatchAsync(
      db
        .update(users)
        .set(Object.fromEntries(entries))
        .where(eq(users.id, id))
        .returning()
    )

    if (error) throw error
    if (!data?.[0]) throw new Error(`Couldn't find user with id ${id}`)

    ConnectionManager.emit(WS_BROADCAST_USERS, await UserManager.onEmitUsers())

    return data[0]!
  }

  static toUserInfo(user: User) {
    const userInfo: UserInfo = { ...user, passwordHash: undefined }
    return { passwordHash: user.passwordHash, userInfo }
  }

  static async adminExists(): Promise<boolean> {
    const { data, error } = await tryCatchAsync(
      db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, 'admin'))
        .limit(1)
    )

    if (error) {
      console.warn(new Date().toISOString(), error.message)
      return false
    }

    return !!data?.length
  }

  static async userExists(email: string): Promise<boolean> {
    const { data, error } = await tryCatchAsync(
      db.query.users.findFirst({ where: eq(users.email, email) })
    )

    if (error) {
      console.warn(new Date().toISOString(), error.message)
      return false
    }

    return !!data
  }

  static async onGetUsers(): Promise<BackendResponse> {
    const { data, error } = await tryCatchAsync(db.select().from(users))
    if (error) throw error
    const userInfos = data.map(r => UserManager.toUserInfo(r).userInfo)
    return { success: true, users: userInfos } satisfies GetUsersResponse
  }

  static async onEmitUsers(): Promise<UserInfo[]> {
    const { data, error } = await tryCatchAsync(db.select().from(users))
    if (error) throw error
    return data.map(r => UserManager.toUserInfo(r).userInfo)
  }
}
