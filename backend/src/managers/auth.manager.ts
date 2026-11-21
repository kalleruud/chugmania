import loc from '@common/locale/locales'
import { isLoginRequest } from '@common/models/auth'
import type { EventReq, EventRes, SocketData } from '@common/models/socket.io'
import { type User, type UserInfo } from '@common/models/user'
import { tryCatchAsync } from '@common/utils/try-catch'
import { isRecord } from '@common/utils/utils'
import jwt, { type JwtPayload } from 'jsonwebtoken'
import type { TypedSocket } from '../server'
import UserManager from './user.manager'

const SECRET: jwt.Secret = (() => {
  const secret = process.env.SECRET
  if (!secret) throw new Error("Missing environment variable 'SECRET'")
  return secret
})()

type TokenData = Omit<SocketData, 'token'> & JwtPayload
type ApiTokenData = TokenData & { tokenId: string }

function isTokenData(data: unknown): data is TokenData {
  if (!isRecord(data)) return false
  return typeof data.userId === 'string'
}

function isApiTokenData(data: unknown): data is ApiTokenData {
  return isTokenData(data) && typeof data.tokenId === 'string'
}

function delay(time: number) {
  return new Promise(resolve => setTimeout(resolve, time))
}

export default class AuthManager {
  // If login is invalid, add a delay.
  private static readonly LOGIN_DELAY = 2_000

  private static readonly JWT_OPTIONS: jwt.SignOptions = {
    algorithm: 'HS512',
    expiresIn: '30DAYS',
  }

  static sign(userId: TokenData['userId']) {
    return jwt.sign({ userId }, SECRET, AuthManager.JWT_OPTIONS)
  }

  static signApiToken(
    userId: ApiTokenData['userId'],
    tokenId: ApiTokenData['tokenId']
  ) {
    return jwt.sign({ userId, tokenId }, SECRET, {
      algorithm: 'HS512',
      noTimestamp: true,
    })
  }

  private static decode(token: string | undefined): TokenData {
    if (!token) throw new Error(loc.no.error.messages.missing_jwt)
    try {
      const data = jwt.verify(token, SECRET, { algorithms: ['HS512'] })
      if (isTokenData(data)) return data
    } catch (error) {
      console.error(
        new Date().toISOString(),
        error instanceof Error ? error.message : error
      )
    }
    throw new Error(loc.no.error.messages.invalid_jwt)
  }

  static verifySession(token: string | undefined): TokenData {
    const data = AuthManager.decode(token)
    if ('tokenId' in data) throw new Error(loc.no.error.messages.invalid_jwt)
    return data
  }

  static verifyApiToken(token: string | undefined): ApiTokenData {
    const data = AuthManager.decode(token)
    if (!isApiTokenData(data) || data.exp !== undefined)
      throw new Error(loc.no.error.messages.invalid_jwt)
    return data
  }

  static async authorize(
    userId: User['id'],
    allowedRoles?: UserInfo['role'][]
  ): Promise<User> {
    const { data: user, error } = await tryCatchAsync(
      UserManager.getUserById(userId)
    )
    if (error) throw new Error(loc.no.error.messages.invalid_jwt)
    if (user.deletedAt || (allowedRoles && !allowedRoles.includes(user.role))) {
      throw new Error(loc.no.error.messages.insufficient_permissions)
    }
    return user
  }

  static async isPasswordValid(
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
    allowedRoles?: UserInfo['role'][],
    allowDefaultEmail?: boolean
  ): Promise<UserInfo> {
    if (!(typeof socket.handshake.auth.token === 'string')) {
      throw new Error(loc.no.error.messages.missing_jwt)
    }

    const { userId } = AuthManager.verifySession(socket.handshake.auth.token)
    const user = await AuthManager.authorize(userId, allowedRoles)

    if (user.email.includes('@chugmania.no') && !allowDefaultEmail) {
      throw new Error(loc.no.error.messages.update_email)
    }

    return UserManager.toUserInfo(user).userInfo
  }

  static async onLogin(
    socket: TypedSocket,
    request: EventReq<'login'>
  ): Promise<EventRes<'login'>> {
    try {
      if (!isLoginRequest(request)) {
        throw new Error(loc.no.error.messages.invalid_request('LoginRequest'))
      }

      const { email, password } = request
      const data = await UserManager.getUser(email)

      const { passwordHash, userInfo } = UserManager.toUserInfo(data)
      const isPasswordValid = await AuthManager.isPasswordValid(
        passwordHash,
        password
      )

      if (!isPasswordValid) {
        throw new Error(loc.no.error.messages.incorrect_password)
      }

      return {
        success: true,
        token: AuthManager.sign(userInfo.id),
        userId: userInfo.id,
      }
    } catch (error) {
      if (!error || typeof error !== 'object' || !('message' in error)) {
        console.error(new Date().toISOString(), socket.id, error)
        throw new Error(loc.no.error.messages.unknown_error, { cause: error })
      }
      await delay(AuthManager.LOGIN_DELAY)
      console.error(new Date().toISOString(), socket.id, error.message)
      throw new Error(loc.no.error.messages.incorrect_login, { cause: error })
    }
  }

  static async refreshToken(
    socket: TypedSocket
  ): Promise<EventRes<'get_user_data'>> {
    const { data: user, error } = await tryCatchAsync(
      AuthManager.checkAuth(socket, undefined, true)
    )
    if (error) {
      socket.data.token = ''
      socket.data.userId = ''
      return {
        success: false,
        message: error.message,
      }
    }
    const token = AuthManager.sign(user.id)
    socket.data.token = token
    socket.data.userId = user.id
    socket.handshake.auth.token = token

    return {
      success: true,
      token,
      userId: user.id,
    }
  }
}
