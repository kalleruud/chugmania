import {
  isLoginRequest,
  isRegisterRequest,
} from '@chugmania/common/models/requests.js'
import type {
  BackendResponse,
  ErrorResponse,
  LoginResponse,
} from '@chugmania/common/models/responses.js'
import { type User, type UserInfo } from '@chugmania/common/models/user.js'
import { tryCatch, tryCatchAsync } from '@chugmania/common/utils/try-catch.js'
import type { users } from '@database/schema'
import jwt from 'jsonwebtoken'
import type { ExtendedError, Socket } from 'socket.io'
import UserManager from './user.manager'

const TOKEN_EXPIRY_H = process.env.TOKEN_EXPIRY_H ?? '1'
const SECRET: jwt.Secret =
  process.env.SECRET ?? Buffer.from(crypto.getRandomValues(new Uint8Array(256)))

const tokenExpiryMs = Number.parseFloat(TOKEN_EXPIRY_H) * 60 * 60 * 1000

export default class AuthManager {
  private static readonly JWT_OPTIONS: jwt.SignOptions = {
    algorithm: 'HS512',
    expiresIn: tokenExpiryMs / 1_000,
  }

  private static sign(user: UserInfo) {
    return jwt.sign(user, SECRET, AuthManager.JWT_OPTIONS)
  }

  private static verify(token: string | undefined): UserInfo {
    if (!token) throw new Error('No JWT token provided')
    return jwt.verify(token, SECRET) as UserInfo
  }

  private static async isPasswordValid(
    providedPassword: string,
    expectedHash: User['passwordHash']
  ) {
    return expectedHash.equals(await AuthManager.hash(providedPassword))
  }

  private static async hash(s: string): Promise<User['passwordHash']> {
    const encoder = new TextEncoder()
    return Buffer.from(await crypto.subtle.digest('SHA-512', encoder.encode(s)))
  }

  static async checkAuth(socket: Socket): Promise<ExtendedError | UserInfo> {
    console.debug(new Date().toISOString(), socket.id, 'Checking auth...')
    const token = socket.handshake.auth.token as string

    if (!token) {
      console.debug(new Date().toISOString(), socket.id, 'No token found')
      return {
        name: 'LoginError',
        message: 'No token provided',
      } satisfies ExtendedError
    }

    console.debug(new Date().toISOString(), socket.id, 'Found token:', token)

    const { data: user, error } = tryCatch(AuthManager.verify(token))
    if (error) {
      console.debug(new Date().toISOString(), socket.id, error.message)
      return error
    }

    console.debug(
      new Date().toISOString(),
      socket.id,
      '👤 Logged in:',
      user.email
    )
    return user
  }

  static async onRegister(
    socket: Socket,
    request: unknown
  ): Promise<BackendResponse> {
    if (!isRegisterRequest(request))
      throw Error('Failed to register: email or password not provided.')

    const { data: user, error } = await tryCatchAsync(
      UserManager.createUser({
        email: request.email,
        name: request.name,
        shortName: request.shortName,
        passwordHash: await AuthManager.hash(request.password),
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
      throw Error('Failed to log in: email or password not provided.')

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
}
