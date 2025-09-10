import { tryCatchAsync } from '@chugmania/common/utils/try-catch.js'
import db from '@database/database'
import { users } from '@database/schema'
import { eq, like } from 'drizzle-orm'
import type { Socket } from 'socket.io'
import type {
  SearchUsersRequest,
} from '@chugmania/common/models/requests.js'
import type { BackendResponse } from '@chugmania/common/models/responses.js'

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

  static async onSearchUsers(
    _s: Socket,
    req?: unknown
  ): Promise<BackendResponse> {
    const { q, limit = 10 } = (req as SearchUsersRequest) ?? { q: '' }

    const query = `%${(q ?? '').trim()}%`
    const { data, error } = await tryCatchAsync(
      db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          shortName: users.shortName,
          role: users.role,
        })
        .from(users)
        .where(q ? like(users.name, query) : undefined)
        .limit(limit)
    )

    if (error) throw error
    return { success: true, users: data }
  }
}
