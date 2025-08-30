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
}
