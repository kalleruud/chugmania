import jwt from 'jsonwebtoken'
import type { Socket } from 'socket.io'
import {
  isLoginRequest,
  isRegisterRequest,
  isUpdateUserRequest,
} from '../../../common/models/requests'
import type {
  BackendResponse,
  ErrorResponse,
  LoginResponse,
  UpdateUserResponse,
} from '../../../common/models/responses'
import {
  WS_BROADCAST_USERS,
  type User,
  type UserInfo,
} from '../../../common/models/user'
import {
  tryCatch,
  tryCatchAsync,
  type Result,
} from '../../../common/utils/try-catch'
import loc from '../../../frontend/lib/locales'
import { users } from '../../database/schema'
import ConnectionManager from './connection.manager'
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

  private static verify(token: string | undefined): Result<TokenData> {
    if (!token)
      return { data: null, error: new Error(loc.no.error.messages.missing_jwt) }
    const { data: user, error } = tryCatch(jwt.verify(token, SECRET))
    if (error) return { data: null, error }
    return {
      data: user as TokenData,
      error: null,
    }
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
    socket: Socket,
    allowedRoles?: UserInfo['role'][]
  ): Promise<Result<UserInfo, ErrorResponse>> {
    const { data, error } = AuthManager.verify(socket.handshake.auth.token)
    if (error)
      return {
        data: null,
        error: {
          success: false,
          message: error.message,
        },
      }

    const { iat, exp, ...user } = data

    const userExists = await UserManager.userExists(user.email)
    if (!userExists) {
      console.warn(
        new Date().toISOString(),
        `User with email '${user.email}' doesn't exist`
      )
      return {
        data: null,
        error: {
          success: false,
          message: loc.no.error.messages.incorrect_email,
        },
      }
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
      console.warn(
        new Date().toISOString(),
        `Role '${user.role}' is not allowed to perform this action.`
      )
      return {
        data: null,
        error: {
          success: false,
          message: loc.no.error.messages.insufficient_permissions,
        },
      }
    }

    return { data: user, error: null }
  }

  static async onRegister(
    socket: Socket,
    request: unknown
  ): Promise<BackendResponse> {
    if (!isRegisterRequest(request))
      throw new Error(loc.no.error.messages.missing_login)

    const adminExists = await UserManager.adminExists()
    const { password, ...insertUser } = request

    const { data: user, error } = await tryCatchAsync(
      UserManager.createUser({
        ...insertUser,
        role: adminExists ? 'user' : 'admin',
        passwordHash: await AuthManager.hash(password),
      } satisfies typeof users.$inferInsert)
    )

    if (error) {
      console.error(new Date().toISOString(), socket.id, error.message)
      return {
        success: false,
        message: error.message,
      } satisfies ErrorResponse
    }

    const userInfo = UserManager.toUserInfo(user).userInfo

    return {
      success: true,
      token: AuthManager.sign(userInfo),
      userInfo,
    } satisfies LoginResponse
  }

  static async onLogin(
    socket: Socket,
    request: unknown
  ): Promise<BackendResponse> {
    if (!isLoginRequest(request)) {
      await delay(AuthManager.LOGIN_DELAY)
      throw new Error(loc.no.error.messages.missing_login)
    }

    const { email, password } = request
    const { data, error } = await tryCatchAsync(UserManager.getUser(email))

    if (error) {
      console.error(new Date().toISOString(), socket.id, error.message)
      await delay(AuthManager.LOGIN_DELAY)
      return {
        success: false,
        message: loc.no.error.messages.incorrect_login,
      } satisfies ErrorResponse
    }

    console.debug(
      new Date().toISOString(),
      socket.id,
      '👤 Logging in:',
      request.email
    )

    const { passwordHash, userInfo } = UserManager.toUserInfo(data)
    const isPasswordValid = await AuthManager.isPasswordValid(
      passwordHash,
      password
    )

    if (!isPasswordValid) {
      console.error(new Date().toISOString(), socket.id, 'Incorrect password')
      await delay(AuthManager.LOGIN_DELAY)
      return {
        success: false,
        message: loc.no.error.messages.incorrect_login,
      } satisfies ErrorResponse
    }

    return {
      success: true,
      token: AuthManager.sign(userInfo),
      userInfo,
    } satisfies LoginResponse
  }

  static async onGetUserData(s: Socket): Promise<BackendResponse> {
    const { data: user, error } = await AuthManager.checkAuth(s)
    if (error) return error
    return {
      success: true,
      token: s.handshake.auth.token,
      userInfo: user,
    } satisfies LoginResponse
  }

  static async onUpdateUser(
    socket: Socket,
    request: unknown
  ): Promise<BackendResponse> {
    const { data: actor, error } = await AuthManager.checkAuth(socket)
    if (error)
      return {
        success: false,
        message: 'Checking auth failed: ' + error.message,
      } satisfies ErrorResponse

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

    ConnectionManager.emit(WS_BROADCAST_USERS, await UserManager.onEmitUsers())

    return {
      success: true,
      userInfo,
      token: AuthManager.sign(isSelf ? userInfo : actor),
    } satisfies UpdateUserResponse
  }
}
