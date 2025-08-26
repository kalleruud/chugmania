import { type User, type UserInfo } from '@common/models/user'
import tryCatch from '@common/utils/try-catch'
import { Buffer } from 'node:buffer'

const TOKEN_EXPIRY_H = process.env.TOKEN_EXPIRY_H ?? '1'
const SECRET = process.env.SECRET
const PRIVATE_KEY = SECRET
  ? new TextEncoder().encode(SECRET)
  : await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-512' }, true, [
      'sign',
      'verify',
    ])

const tokenExpiryMs = Number.parseFloat(TOKEN_EXPIRY_H) * 60 * 60 * 1000

export default class AuthManager {
  static readonly AUTH_COOKIE_KEY = 'auth'

  static async sign(user: UserInfo) {
    return await new SignJWT(user)
      .setProtectedHeader({ alg: 'SH512' })
      .setIssuedAt()
      .setExpirationTime(tokenExpiryMs)
      .sign(PRIVATE_KEY)
  }

  static async verify(token: string) {
    const { data, error } = await tryCatch(
      jwtVerify<UserInfo>(token, PRIVATE_KEY)
    )
    if (error) {
      console.error('Invalid JWT:', error)
      return undefined
    }
    console.log('JWT verified')
    return data.payload
  }

  static async checkPassword(
    password: string,
    expectedHash: User['passwordHash']
  ) {
    if (expectedHash.equals(await this.hash(password))) return
    throw Error('The provided password is incorrect')
  }

  static async hash(s: string): Promise<User['passwordHash']> {
    const encoder = new TextEncoder()
    return Buffer.from(await crypto.subtle.digest('SHA-512', encoder.encode(s)))
  }
}
