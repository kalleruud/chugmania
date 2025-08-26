import { type User, type UserInfo } from '@common/models/user'
import tryCatch from '@common/utils/try-catch'
import { type Secret, type SignOptions, sign, verify } from 'jsonwebtoken'

const TOKEN_EXPIRY_H = process.env.TOKEN_EXPIRY_H ?? '1'
const SECRET: Secret =
  process.env.SECRET ?? Buffer.from(crypto.getRandomValues(new Uint8Array(256)))

const tokenExpiryMs = Number.parseFloat(TOKEN_EXPIRY_H) * 60 * 60 * 1000

export default class AuthManager {
  static readonly AUTH_COOKIE_KEY = 'auth'
  private static readonly JWT_OPTIONS: SignOptions = {
    algorithm: 'HS512',
    expiresIn: tokenExpiryMs / 1_000,
  }

  static sign(user: UserInfo) {
    return sign(user, SECRET, this.JWT_OPTIONS)
  }

  static async verify(
    token: string | undefined
  ): Promise<UserInfo | undefined> {
    if (!token) {
      console.error('Invalid JWT: No token provided')
      return undefined
    }

    const { data, error } = await tryCatch(
      new Promise<UserInfo>((resolve, reject) => {
        verify(token, SECRET, (err, decoded) => {
          if (err) reject(err)
          else if (decoded) resolve(decoded as UserInfo)
          else
            reject(new Error('JWT verification failed: Decoded data is empty.'))
        })
      })
    )

    if (error) {
      console.error('Invalid JWT:', error)
      return undefined
    }

    console.log('JWT verified')
    return data
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
