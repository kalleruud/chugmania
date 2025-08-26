import { UserInfo } from '@common/models/user.ts'
import tryCatch from '@common/utils/try-catch.ts'
import db from '@database/database.ts'
import { users } from '@database/schema.ts'
import { eq } from 'drizzle-orm'
import AuthManager from './auth.manager.ts'

export default class UserManager {
  static readonly table = users

  static async login(email: string, password: string): Promise<UserInfo> {
    const { data: user, error } = await tryCatch(
      db.query.users.findFirst({ where: eq(users.email, email) })
    )

    if (error) throw error
    if (!user) throw Error(`Couldn't find user with email ${email}`)
    const { passwordHash, ...userInfo } = user

    await AuthManager.checkPassword(password, passwordHash)
    return userInfo
  }
}
