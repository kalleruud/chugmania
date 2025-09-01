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

  static async getUserById(id: string) {
    const { data: user, error } = await tryCatchAsync(
      db.query.users.findFirst({ where: eq(users.id, id) })
    )
    if (error) throw error
    if (!user) throw Error(`Couldn't find user with id ${id}`)
    return user
  }

  static async listUsers() {
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
    )
    if (error) throw error
    return data
  }

  static async updateUser(
    id: string,
    patch: Partial<
      Pick<typeof users.$inferInsert, 'name' | 'shortName' | 'role'>
    >
  ) {
    const { data, error } = await tryCatchAsync(
      db.update(users).set(patch).where(eq(users.id, id)).returning()
    )
    if (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        if (error.message.includes('users.shortName'))
          error.message = 'Short name already in use'
      }
      throw error
    }
    return data[0]!
  }

  static async deleteUser(id: string) {
    const { data, error } = await tryCatchAsync(
      db.delete(users).where(eq(users.id, id)).returning()
    )
    if (error) throw error
    return data[0]!
  }

  static async createUser(userData: typeof users.$inferInsert) {
    const { data: user, error } = await tryCatchAsync(
      db.insert(users).values(userData).returning()
    )

    if (error) {
      // Surface clearer unique-constraint messages
      if (error.message.includes('UNIQUE constraint failed')) {
        if (error.message.includes('users.email')) {
          error.message = 'Email already registered'
        } else if (error.message.includes('users.shortName')) {
          error.message = 'Short name already in use'
        } else {
          error.message = 'Unique constraint failed'
        }
      }
      throw error
    }

    if (user.length != 1)
      throw new Error('Unknown error: Failed to create user')
    return user[0]!
  }
}
