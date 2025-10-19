import jwt from 'jsonwebtoken'
import type { Socket } from 'socket.io'
import {
  isLoginRequest,
  isRegisterRequest,
} from '../../../common/models/requests'
import type {
  BackendResponse,
  ErrorResponse,
  LoginResponse,
} from '../../../common/models/responses'
import { type User, type UserInfo } from '../../../common/models/user'
import {
  tryCatch,
  tryCatchAsync,
  type Result,
} from '../../../common/utils/try-catch'
import { users } from '../../database/schema'
import UserManager from './user.manager'

const SECRET: jwt.Secret = process.env.SECRET!
if (!SECRET) throw new Error("Missing environment variable 'SECRET'")

export default class AuthManager {
  private static readonly JWT_OPTIONS: jwt.SignOptions = {
    algorithm: 'HS512',
    expiresIn: '30DAYS',
  }

  private static sign(user: UserInfo) {
    return jwt.sign(user, SECRET, AuthManager.JWT_OPTIONS)
  }

  private static verify(token: string | undefined): Result<UserInfo> {
    if (!token) return { data: null, error: new Error('No JWT token provided') }
    const { data: user, error } = tryCatch(jwt.verify(token, SECRET))
    if (error) return { data: null, error }
    return { data: user as UserInfo, error: null }
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
    const result = AuthManager.verify(socket.handshake.auth.token)
    if (result.error)
      return {
        data: null,
        error: {
          success: false,
          message: result.error.message,
        },
      }

    const user = result.data

    const userExists = await UserManager.userExists(user.email)
    if (!userExists) {
      const message = `User with email '${user.email}' doesn't exist`
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
      const message = `Role '${user.role}' is not allowed to perform this action.`
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
      throw new Error('Failed to register: email or password not provided.')

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
      throw new Error('Failed to log in: email or password not provided.')

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
      console.error(new Date().toISOString(), socket.id, 'User not found')
      return {
        success: false,
        message: 'User not found',
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
          message: 'Incorrect password',
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
}
