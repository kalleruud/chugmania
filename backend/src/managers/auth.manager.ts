import jwt from 'jsonwebtoken'
import type { Socket } from 'socket.io'
import { t } from '../../../common/locales/translateServer'
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
import { type User, type UserInfo } from '../../../common/models/user'
import { WS_UPDATE_USER } from '../../../common/utils/constants'
import {
  tryCatch,
  tryCatchAsync,
  type Result,
} from '../../../common/utils/try-catch'
import { users } from '../../database/schema'
import ConnectionManager from './connection.manager'
import UserManager from './user.manager'

const SECRET: jwt.Secret = process.env.SECRET!
if (!SECRET) throw new Error(t('messages.auth.secretNotConfigured'))

type TokenData = UserInfo & { iat: number; exp: number }

export default class AuthManager {
  private static readonly JWT_OPTIONS: jwt.SignOptions = {
    algorithm: 'HS512',
    expiresIn: '30DAYS',
  }

  private static sign(user: UserInfo) {
    return jwt.sign(user, SECRET, AuthManager.JWT_OPTIONS)
  }

  private static verify(token: string | undefined): Result<TokenData> {
    if (!token)
      return { data: null, error: new Error(t('messages.auth.noJwtToken')) }
    const { data: user, error } = tryCatch(jwt.verify(token, SECRET))
    if (error) return { data: null, error }
    return {
      data: user as TokenData,
      error: null,
    }
  }

  private static async isPasswordValid(
    providedPassword: string,
    expectedHash: User['passwordHash']
  ) {
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
      const message = t('messages.auth.userDoesNotExist')
      console.warn(new Date().toISOString(), message)
      return {
        data: null,
        error: {
          success: false,
          message,
        },
      }
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
      const message = t('messages.auth.roleNotAllowed')
      console.warn(new Date().toISOString(), message)
      return {
        data: null,
        error: {
          success: false,
          message,
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
      throw new Error(t('messages.validation.missingEmailOrPassword'))

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
    if (!isLoginRequest(request))
      throw new Error(t('messages.validation.missingEmailOrPassword'))

    const { email, password } = request
    const { data, error } = await tryCatchAsync(UserManager.getUser(email))

    if (error) {
      console.error(new Date().toISOString(), socket.id, error.message)
      return {
        success: false,
        message: error.message,
      } satisfies ErrorResponse
    }

    if (!data) {
      console.error(
        new Date().toISOString(),
        socket.id,
        t('messages.auth.emailNotFound')
      )
      return {
        success: false,
        message: t('messages.auth.emailNotFound'),
      } satisfies ErrorResponse
    }

    console.debug(
      new Date().toISOString(),
      socket.id,
      '👤 Logging in:',
      request.email
    )

    const { passwordHash, userInfo } = UserManager.toUserInfo(data)

    return (await AuthManager.isPasswordValid(password, passwordHash))
      ? ({
          success: true,
          token: AuthManager.sign(userInfo),
          userInfo,
        } satisfies LoginResponse)
      : ({
          success: false,
          message: t('messages.auth.incorrectPassword'),
        } satisfies ErrorResponse)
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
        message: 'Invalid update user request',
      } satisfies ErrorResponse
    }

    const isSelf = actor.id === request.id
    const isAdmin = actor.role === 'admin'

    if (!isSelf && !isAdmin) {
      return {
        success: false,
        message: t('messages.auth.notPermittedToUpdateUser'),
      } satisfies ErrorResponse
    }

    const targetUser = await UserManager.getUserById(request.id)
    const passwordValid = await AuthManager.isPasswordValid(
      request.password,
      targetUser.passwordHash
    )

    if (!passwordValid && !isAdmin) {
      return {
        success: false,
        message: t('messages.auth.incorrectCurrentPassword'),
      } satisfies ErrorResponse
    }

    const updates: Partial<typeof users.$inferInsert> = request

    if (request.newPassword) {
      updates.passwordHash = await AuthManager.hash(request.newPassword)
    }

    const updatedUser = await UserManager.updateUser(request.id, updates)
    const { userInfo } = UserManager.toUserInfo(updatedUser)
    ConnectionManager.emit(WS_UPDATE_USER, updatedUser)

    return {
      success: true,
      userInfo,
      token: AuthManager.sign(isSelf ? userInfo : actor),
    } satisfies UpdateUserResponse
  }
}
