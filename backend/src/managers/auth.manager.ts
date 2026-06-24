import { isLoginRequest } from '@common/models/auth'
import type { EventReq, EventRes, SocketData } from '@common/models/socket.io'
import { type User, type UserInfo } from '@common/models/user'
import { tryCatch, tryCatchAsync } from '@common/utils/try-catch'
import { isRecord } from '@common/utils/is-record'
import jwt, { type JwtPayload } from 'jsonwebtoken'
import loc from '../../../frontend/lib/locales'
import type { TypedSocket } from '../server'
import UserManager from './user.manager'

const SECRET: jwt.Secret = (() => {
  const secret = process.env.SECRET
  if (!secret) throw new Error("Missing environment variable 'SECRET'")
  return secret
})()

type TokenData = Omit<SocketData, 'token'> & JwtPayload

function isTokenData(data: unknown): data is TokenData {
  if (!isRecord(data)) return false
  return typeof data.userId === 'string'
}

function delay(time: number) {
  return new Promise(resolve => setTimeout(resolve, time))
}

class AuthManagerClass {
  private readonly LOGIN_DELAY = 1000

  private readonly JWT_OPTIONS: jwt.SignOptions = {
    algorithm: 'HS512',
    expiresIn: '30DAYS',
  }

  sign(userId: TokenData['userId']) {
    return jwt.sign({ userId }, SECRET, AuthManager.JWT_OPTIONS)
  }

  private async verify(token: string | undefined): Promise<TokenData> {
    if (!token) throw new Error(loc.no.error.messages.missing_jwt)
    const { data, error } = tryCatch(jwt.verify(token, SECRET))
    if (error) {
      console.error(new Date().toISOString(), error)
      throw new Error(loc.no.error.messages.invalid_jwt)
    }
    if (!isTokenData(data)) throw new Error(loc.no.error.messages.invalid_jwt)

    const { error: userError } = await tryCatchAsync(
      UserManager.getUserById(data.userId)
    )
    if (userError) throw new Error(loc.no.error.messages.invalid_jwt)

    return data
  }

  async isPasswordValid(
    expectedHash: User['passwordHash'],
    providedPassword?: string
  ) {
    if (!providedPassword) return false
    return expectedHash.equals(await AuthManager.hash(providedPassword))
  }

  async hash(s: string): Promise<User['passwordHash']> {
    const encoder = new TextEncoder()
    return Buffer.from(await crypto.subtle.digest('SHA-512', encoder.encode(s)))
  }

  async checkAuth(
    socket: TypedSocket,
    allowedRoles?: UserInfo['role'][],
    allowDefaultEmail?: boolean
  ): Promise<UserInfo> {
    const token =
      typeof socket.handshake.auth.token === 'string'
        ? socket.handshake.auth.token
        : undefined
    const { userId } = await AuthManager.verify(token)
    const user = await UserManager.getUserById(userId)

    if (allowedRoles && !allowedRoles.includes(user.role)) {
      throw new Error(loc.no.error.messages.insufficient_permissions)
    }

    if (user.email.includes('@chugmania.no') && !allowDefaultEmail) {
      throw new Error(loc.no.error.messages.update_email)
    }

    return UserManager.toUserInfo(user).userInfo
  }

  async onLogin(
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
      await delay(AuthManager.LOGIN_DELAY)
      if (!error || typeof error !== 'object' || !('message' in error)) {
        console.error(new Date().toISOString(), socket.id, error)
        throw new Error(loc.no.error.messages.unknown_error)
      }
      console.error(new Date().toISOString(), socket.id, error.message)
      throw new Error(loc.no.error.messages.incorrect_login)
    }
  }

  async refreshToken(
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
const AuthManager = new AuthManagerClass()

export default AuthManager
