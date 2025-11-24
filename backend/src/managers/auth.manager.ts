import jwt from 'jsonwebtoken'
import { isLoginRequest } from '../../../common/models/auth'
import type {
  BackendResponse,
  ErrorResponse,
} from '../../../common/models/responses'
import { EventCb, EventReq, EventRes } from '../../../common/models/socket.io'
import {
  isUserInfo,
  WS_BROADCAST_USER_DATA,
  WS_BROADCAST_USERS,
  type User,
  type UserInfo,
} from '../../../common/models/user'
import { tryCatch } from '../../../common/utils/try-catch'
import loc from '../../../frontend/lib/locales'
import { users } from '../../database/schema'
import { TypedSocket } from '../server'
import UserManager from './user.manager'

const SECRET: jwt.Secret = process.env.SECRET!
if (!SECRET) throw new Error("Missing environment variable 'SECRET'")

type TokenData = UserInfo & { iat: number; exp: number }

function delay(time: number) {
  return new Promise(resolve => setTimeout(resolve, time))
}

export default class AuthManager {
  private static readonly LOGIN_DELAY = 1000

  private static readonly JWT_OPTIONS: jwt.SignOptions = {
    algorithm: 'HS512',
    expiresIn: '30DAYS',
  }

  private static sign(user: UserInfo) {
    return jwt.sign(user, SECRET, AuthManager.JWT_OPTIONS)
  }

  private static async verify(token: string | undefined): Promise<TokenData> {
    if (!token) throw new Error(loc.no.error.messages.missing_jwt)
    const { data: user, error } = tryCatch(jwt.verify(token, SECRET))
    if (error) {
      console.error(new Date().toISOString(), error)
      throw new Error(loc.no.error.messages.invalid_jwt)
    }
    if (!isUserInfo(user)) throw new Error(loc.no.error.messages.invalid_jwt)
    return user as TokenData
  }

  private static async isPasswordValid(
    expectedHash: User['passwordHash'],
    providedPassword?: string
  ) {
    if (!providedPassword) return false
    return expectedHash.equals(await AuthManager.hash(providedPassword))
  }

  static async hash(s: string): Promise<User['passwordHash']> {
    const encoder = new TextEncoder()
    return Buffer.from(await crypto.subtle.digest('SHA-512', encoder.encode(s)))
  }

  static async checkAuth(
    socket: TypedSocket,
    allowedRoles?: UserInfo['role'][]
  ): Promise<UserInfo> {
    const { iat, exp, ...tokenData } = await AuthManager.verify(
      socket.handshake.auth.token
    )

    const user = await UserManager.getUserById(tokenData.id)

    if (allowedRoles && !allowedRoles.includes(user.role)) {
      throw new Error(loc.no.error.messages.insufficient_permissions)
    }

    return UserManager.toUserInfo(user).userInfo
  }

  static async onLogin(
    socket: TypedSocket,
    request: EventReq<'login'>
  ): Promise<EventRes<'login'>> {
    if (!isLoginRequest(request)) {
      await delay(AuthManager.LOGIN_DELAY)
      throw new Error(loc.no.error.messages.missing_login)
    }
    try {
      const { email, password } = request
      const data = await UserManager.getUser(email)

      const { passwordHash, userInfo } = UserManager.toUserInfo(data)
      const isPasswordValid = await AuthManager.isPasswordValid(
        passwordHash,
        password
      )

      if (!isPasswordValid) {
        throw new Error('Incorrect password')
      }

      return {
        success: true,
        token: AuthManager.sign(userInfo),
        userInfo,
      }
    } catch (error) {
      await delay(AuthManager.LOGIN_DELAY)
      if (!error || typeof error !== 'object' || !('message' in error)) {
        console.error(new Date().toISOString(), socket.id, error)
        throw new Error(loc.no.error.messages.unknown_error)
      }
      console.error(new Date().toISOString(), socket.id, error.message)
      throw new Error(loc.no.error.messages.incorrect_login)
    }
  }

  static async onGetUserData(
    socket: TypedSocket,
    cb: EventCb<"login">,
    res: EventRes<"login">,
    cbD: EventCb<"get_user_data">,
    resD: EventRes<"get_user_data">
  ): Promise<EventRes<"get_user_data">> {
    const user = await AuthManager.checkAuth(socket)

    return {
      success: true,
      token: socket.handshake.auth.token,
      userInfo: user,
    }
  }

  static async onUpdateUser(
    socket: TypedSocket,
    request: unknown
  ): Promise<BackendResponse> {
    const actor = await AuthManager.checkAuth(socket)

    if (!isUpdateUserRequest(request)) {
      return {
        success: false,
        message: loc.no.error.description,
      } satisfies ErrorResponse
    }

    const isSelf = actor.id === request.id
    const isAdmin = actor.role === 'admin'

    if (!isSelf && !isAdmin) {
      return {
        success: false,
        message: loc.no.error.messages.insufficient_permissions,
      } satisfies ErrorResponse
    }

    const targetUser = await UserManager.getUserById(request.id)
    const passwordValid = await AuthManager.isPasswordValid(
      targetUser.passwordHash,
      request.password
    )

    if (!passwordValid && !isAdmin) {
      return {
        success: false,
        message: loc.no.error.messages.incorrect_password,
      } satisfies ErrorResponse
    }

    const updates: Partial<typeof users.$inferInsert> = request

    if (request.newPassword) {
      updates.passwordHash = await AuthManager.hash(request.newPassword)
    }

    const updatedUser = await UserManager.updateUser(request.id, updates)
    const { userInfo } = UserManager.toUserInfo(updatedUser)

    console.info(
      new Date().toISOString(),
      socket.id,
      `Updated user '${userInfo.email}'`
    )

    const response = {
      success: true,
      userInfo,
      token: AuthManager.sign(isSelf ? userInfo : actor),
    } satisfies UpdateUserResponse

    socket.emit(WS_BROADCAST_USER_DATA, response)
    ConnectionManager.emit(WS_BROADCAST_USERS, await UserManager.onEmitUsers())

    return response
  }
}
