import { type UserInfo } from '@common/models/user'
import tryCatch from '@common/utils/try-catch'
import db from '@database/database'
import { users } from '@database/schema'
import { eq } from 'drizzle-orm'
import AuthManager from './auth.manager'

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
