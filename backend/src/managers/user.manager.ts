import type {
  BackendResponse,
  GetUsersResponse,
} from '@chugmania/common/models/responses.js'
import type { User, UserInfo } from '@chugmania/common/models/user.js'
import { tryCatchAsync } from '@chugmania/common/utils/try-catch.js'
import db from '@database/database'
import { users } from '@database/schema'
import { eq } from 'drizzle-orm'

export default class UserManager {
  static readonly table = users

  static async getUser(email: string) {
    const { data: user, error } = await tryCatchAsync(
      db.query.users.findFirst({ where: eq(users.email, email) })
    )

    if (error) throw error
    if (!user) throw Error(`Couldn't find user with email ${email}`)

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

  static toUserInfo(user: User) {
    const userInfo: UserInfo = { ...user, passwordHash: undefined }
    return { passwordHash: user.passwordHash, userInfo }
  }

  static async onGetUsers(): Promise<BackendResponse> {
    const { data, error } = await tryCatchAsync(db.select().from(users))

    if (error) throw error

    const userInfos = data.map(r => UserManager.toUserInfo(r).userInfo)

    return { success: true, users: userInfos } satisfies GetUsersResponse
  }
}
