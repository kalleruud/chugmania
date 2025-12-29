import { isRegisterRequest } from '@common/models/auth'
import type { EventReq, EventRes } from '@common/models/socket.io'
import {
  isDeleteUserRequest,
  isEditUserRequest,
  type LoginResponse,
  type User,
  type UserInfo,
} from '@common/models/user'
import { tryCatchAsync } from '@common/utils/try-catch'
import { eq, isNull } from 'drizzle-orm'
import loc from '../../../frontend/lib/locales'
import db from '../../database/database'
import { users } from '../../database/schema'
import { broadcast, type TypedSocket } from '../server'
import RatingManager from './rating.manager'
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

  static async getUserById(id: User['id']) {
    const user = await db.query.users.findFirst({ where: eq(users.id, id) })
    if (!user) throw new Error(loc.no.error.messages.not_in_db(id))
    return user
  }

  static async updateUser(
    id: User['id'],
    updates: Partial<typeof UserManager.table.$inferInsert>
  ): Promise<User> {
    const entries = Object.entries({
      ...updates,
      createdAt: updates.createdAt ? new Date(updates.createdAt) : undefined,
      deletedAt: updates.deletedAt ? new Date(updates.deletedAt) : undefined,
      updatedAt: undefined,
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
    if (!isEditUserRequest(request)) {
      throw new Error(loc.no.error.messages.invalid_request('EditUserRequest'))
    }

    const actor = await AuthManager.checkAuth(socket)

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
    broadcast('all_time_entries', await TimeEntryManager.getAllTimeEntries())

    return {
      success: true,
    }
  }

  static async onDeleteUser(
    socket: TypedSocket,
    request: EventReq<'delete_user'>
  ): Promise<EventRes<'delete_user'>> {
    if (!isDeleteUserRequest(request)) {
      throw new Error(
        loc.no.error.messages.invalid_request('DeleteUserRequest')
      )
    }

    await AuthManager.checkAuth(socket, ['admin'])

    const deletedUser = await UserManager.updateUser(request.id, {
      deletedAt: new Date(),
    })

    // Soft-delete all time entries for this user
    await TimeEntryManager.deleteTimeEntriesForUser(request.id)

    console.info(
      new Date().toISOString(),
      socket.id,
      `Deleted user '${deletedUser.email}' and their time entries`
    )

    broadcast('all_users', await UserManager.getAllUsers())
    broadcast('all_time_entries', await TimeEntryManager.getAllTimeEntries())

    return {
      success: true,
    }
  }

  static async onRegister(
    socket: TypedSocket,
    request: EventReq<'register'>
  ): Promise<EventRes<'register'>> {
    if (!isRegisterRequest(request)) {
      throw new Error(loc.no.error.messages.invalid_request('RegisterRequest'))
    }

    const { data: actor } = await tryCatchAsync(AuthManager.checkAuth(socket))
    if (actor && actor?.role !== 'admin' && request.role !== 'user') {
      throw new Error(loc.no.error.messages.insufficient_permissions)
    }

    const userAlreadyExists = await UserManager.userExists(request.email)
    if (userAlreadyExists) {
      throw new Error(loc.no.error.messages.email_already_exists)
    }

    const isFirstUser = !(await UserManager.adminExists())
    const role = isFirstUser ? 'admin' : (request.role ?? 'user')

    const passwordHash = await AuthManager.hash(request.password)

    const { password, createdAt, role: _, ...user } = request
    const newUser = await db
      .insert(users)
      .values({
        ...user,
        createdAt: createdAt ? new Date(createdAt) : undefined,
        passwordHash,
        role,
      })
      .returning()

    const createdUser = newUser.at(0)
    if (!createdUser) throw new Error(loc.no.error.messages.db_failed)

    const { userInfo } = UserManager.toUserInfo(createdUser)

    console.info(
      new Date().toISOString(),
      socket.id,
      `Registered user '${userInfo.email}' with role '${role}'`
    )

    broadcast('all_users', await UserManager.getAllUsers())

    return { success: true }
  }

  static async getAllUsers(): Promise<UserInfo[]> {
    const data = await db.select().from(users).where(isNull(users.deletedAt))
    if (data.length === 0)
      throw new Error(loc.no.error.messages.not_in_db(loc.no.users.title))

    const rankings = RatingManager.getRankings()
    const usersInfo = data.map(r => UserManager.toUserInfo(r).userInfo)

    return usersInfo.sort((a, b) => {
      const rankA =
        rankings.find(r => r.user === a.id)?.ranking ?? Number.MAX_SAFE_INTEGER
      const rankB =
        rankings.find(r => r.user === b.id)?.ranking ?? Number.MAX_SAFE_INTEGER

      if (rankA !== rankB) {
        return rankA - rankB
      }

      return a.firstName.localeCompare(b.firstName)
    })
  }
}
