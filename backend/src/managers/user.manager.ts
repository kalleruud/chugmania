import { eq } from 'drizzle-orm'
import { EventReq, EventRes } from '../../../common/models/socket.io'
import {
  isEditUserRequest,
  LoginResponse,
  type User,
  type UserInfo,
} from '../../../common/models/user'
import { tryCatchAsync } from '../../../common/utils/try-catch'
import loc from '../../../frontend/lib/locales'
import db from '../../database/database'
import { users } from '../../database/schema'
import { broadcast, TypedSocket } from '../server'
import AuthManager from './auth.manager'
import TimeEntryManager from './timeEntry.manager'

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

  private static async createUser(userData: typeof users.$inferInsert) {
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
    const user = await db.query.users.findFirst({ where: eq(users.id, id) })
    if (!user) throw new Error(loc.no.error.messages.not_in_db(id))
    return user
  }

  static async updateUser(
    id: User['id'],
    updates: Partial<typeof this.table.$inferInsert>
  ): Promise<User> {
    const entries = Object.entries({
      ...updates,
      createdAt: updates.createdAt ? new Date(updates.createdAt) : undefined,
      updatedAt: undefined,
      deletedAt: undefined,
    } satisfies typeof updates).filter(([, value]) => value !== undefined)

    if (entries.length === 0) {
      throw new Error(loc.no.error.messages.missing_data)
    }

    const data = await db
      .update(users)
      .set(Object.fromEntries(entries))
      .where(eq(users.id, id))
      .returning()

    const user = data[0]
    if (!user) throw new Error(loc.no.error.messages.not_in_db(id))

    broadcast('all_users', await UserManager.getAllUsers())
    return user
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

  static async onEditUser(
    socket: TypedSocket,
    request: EventReq<'edit_user'>
  ): Promise<EventRes<'edit_user'>> {
    const actor = await AuthManager.checkAuth(socket)

    if (!isEditUserRequest(request)) {
      throw new Error(loc.no.error.messages.invalid_request('EditUserRequest'))
    }

    const isSelf = actor.id === request.id
    const isAdmin = actor.role === 'admin'

    if (!isSelf && !isAdmin) {
      throw new Error(loc.no.error.messages.insufficient_permissions)
    }

    const targetUser = await UserManager.getUserById(request.id)
    const passwordValid = await AuthManager.isPasswordValid(
      targetUser.passwordHash,
      request.password
    )

    if (!passwordValid && !isAdmin) {
      throw new Error(loc.no.error.messages.incorrect_password)
    }

    const updates: Partial<typeof users.$inferInsert> = {
      email: request.email,
      firstName: request.firstName,
      lastName: request.lastName,
      shortName: request.shortName,
      deletedAt: request.deletedAt,
      passwordHash: request.newPassword
        ? await AuthManager.hash(request.newPassword)
        : undefined,
    }

    // Only admins can set role and createdAt
    if (isAdmin) {
      if (request.role !== undefined) {
        updates.role = request.role
      }
      if (request.createdAt !== undefined) {
        updates.createdAt = request.createdAt
      }
    }

    const updatedUser = await UserManager.updateUser(request.id, updates)
    const { userInfo } = UserManager.toUserInfo(updatedUser)

    console.info(
      new Date().toISOString(),
      socket.id,
      `Updated user '${userInfo.email}'`
    )

    const response: LoginResponse = {
      success: true,
      token: AuthManager.sign(userInfo.id),
      userId: userInfo.id,
    }

    if (isSelf) {
      socket.emit('user_data', response)
    }

    broadcast('all_users', await UserManager.getAllUsers())
    broadcast('all_leaderboards', await TimeEntryManager.getAllTimeEntries())

    return {
      success: true,
    }
  }

  static async onRegister(
    socket: TypedSocket,
    request: EventReq<'register'>
  ): Promise<EventRes<'register'>> {
    throw new Error('Not implemented')
  }

  static async getAllUsers(): Promise<UserInfo[]> {
    const data = await db.select().from(users)
    if (data.length === 0)
      throw new Error(loc.no.error.messages.not_in_db(loc.no.users.title))
    return data.map(r => UserManager.toUserInfo(r).userInfo)
  }
}
