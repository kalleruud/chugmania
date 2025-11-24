import jwt from 'jsonwebtoken'
import { isLoginRequest } from '../../../common/models/auth'
import { EventReq, EventRes } from '../../../common/models/socket.io'
import {
  isUserInfo,
  type User,
  type UserInfo,
} from '../../../common/models/user'
import { tryCatch } from '../../../common/utils/try-catch'
import loc from '../../../frontend/lib/locales'
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

  static sign(user: UserInfo) {
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
    socket: TypedSocket
  ): Promise<EventRes<'get_user_data'>> {
    const user = await AuthManager.checkAuth(socket)

    return {
      success: true,
      token: socket.handshake.auth.token,
      userInfo: user,
    }
  }
}
