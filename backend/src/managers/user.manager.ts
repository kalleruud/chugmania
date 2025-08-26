import { UserInfo } from '@common/models/user.ts'
import tryCatch from '@common/utils/try-catch.ts'
import { eq } from 'drizzle-orm'
import { users } from '../../schema/users.ts'
import db from '../database.ts'
import AuthManager from './auth.manager.ts'

export default class UserManager {
  static readonly table = users

  static async login(email: string, password: string): Promise<UserInfo> {
    const { data, error } = await tryCatch(
      db.select().from(users).where(eq(users.email, email))
    )

    if (error) throw error
    if (data.length > 0) throw Error(`Couldn't find user with email ${email}`)
    const { passwordHash, ...userInfo } = data[0]

    const { error: failed } = await tryCatch(
      AuthManager.checkPassword(password, passwordHash)
    )
    if (failed) throw Error(`Incorrect password ${email}`)

    return userInfo
  }
}
