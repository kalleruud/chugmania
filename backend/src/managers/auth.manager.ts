import { type User, type UserInfo } from '@chugmania/common/models/user.js'
import tryCatch from '@chugmania/common/utils/try-catch.js'
import jwt from 'jsonwebtoken'

import type { Socket } from 'socket.io'

const TOKEN_EXPIRY_H = process.env.TOKEN_EXPIRY_H ?? '1'
const SECRET: jwt.Secret =
  process.env.SECRET ?? Buffer.from(crypto.getRandomValues(new Uint8Array(256)))

const tokenExpiryMs = Number.parseFloat(TOKEN_EXPIRY_H) * 60 * 60 * 1000

export default class AuthManager {
  static readonly AUTH_COOKIE_KEY = 'auth'
  private static readonly JWT_OPTIONS: jwt.SignOptions = {
    algorithm: 'HS512',
    expiresIn: tokenExpiryMs / 1_000,
  }

  static sign(user: UserInfo) {
    return jwt.sign(user, SECRET, this.JWT_OPTIONS)
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
        jwt.verify(token, SECRET, (err, decoded) => {
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

  static async checkAuth(socket: Socket) {
    console.debug(new Date().toISOString(), socket.id, '🔑 Checking auth...')
    const token = socket.handshake.auth.token
    if (token)
      console.debug(
        new Date().toISOString(),
        socket.id,
        '🔓 Found token:',
        token
      )
    else console.debug(new Date().toISOString(), socket.id, '🔒 No token found')
  }
}
