import { ENV, ISSUER, PRIVATE_KEY, TOKEN_EXPIRY } from '$env/static/private'
import db from '$lib/server/db'
import { hash } from '@/utils'
import { type Cookies } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'
import jwt from 'jsonwebtoken'
import { users } from '../db/schema'
import type { FailDetails } from './utils'
import type { LookupEntity } from '@/components/track-lookup/track-grid.server'

if (!ISSUER) throw new Error('Missing environment variable: ISSUER')

type User = typeof users.$inferSelect
export type PublicUser = Omit<User, 'passwordHash'> & { passwordHash: undefined }

const authCookieKey = 'auth'
const privateKey: jwt.Secret = PRIVATE_KEY ?? crypto.getRandomValues(new Uint8Array(256))
const jwtOptions: jwt.SignOptions = {
  issuer: ISSUER,
  algorithm: 'HS256',
  expiresIn: TOKEN_EXPIRY,
}

export default class UserManager {
  static readonly table = users

  static isUser(user: unknown): user is User {
    if (!user) return false
    if (!(user instanceof Object)) return false
    return 'email' in user && 'passwordHash' in user
  }

  static verifyAuth(cookies: Cookies): PublicUser | FailDetails {
    try {
      const token = cookies.get(authCookieKey)
      if (!token) return { status: 401, message: 'No auth token provided' }

      return jwt.verify(token, privateKey, jwtOptions) as PublicUser
    } catch (error) {
      if (!(error instanceof jwt.JsonWebTokenError)) throw error
      console.error('Failed to verify token:', error.message)
      return { status: 401, message: 'Unauthorized' }
    }
  }

  private static generateToken(user: typeof users.$inferSelect) {
    return jwt.sign(this.getDetails(user), privateKey, jwtOptions)
  }

  static async getUser(email: string): Promise<User | FailDetails> {
    const result = await db.select().from(users).where(eq(users.email, email))
    const user = result.at(0)

    if (!user) {
      console.warn('User not found for email:', email)
      return { status: 404, message: `User '${email}' not found` }
    }

    return user
  }

  static async getAll(): Promise<PublicUser[]> {
    return (await db.select().from(users)).map(this.getDetails)
  }

  static async getAllLookup(): Promise<LookupEntity[]> {
    return (await this.getAll()).map(user => ({
      ...user,
      label: user.name ?? user.email,
    }))
  }

  static async userExists(email: string) {
    const user = await this.getUser(email)
    return this.isUser(user)
  }

  static async logout(cookies: Cookies) {
    cookies.delete(authCookieKey, { path: '/' })
  }

  static async loginEmail(
    email: string,
    providedPassword: string,
    cookies: Cookies
  ): ReturnType<typeof UserManager.loginUser> {
    const [user, passwordHash] = await Promise.all([this.getUser(email), hash(providedPassword)])
    if (!this.isUser(user)) return user
    return this.loginUser(user, passwordHash, cookies)
  }

  static async loginUser(
    user: User,
    providedHash: ArrayBuffer,
    cookies: Cookies
  ): Promise<string | FailDetails> {
    if (!this.isPasswordValid(providedHash, user.passwordHash)) {
      console.warn('Invalid password for user:', user.email)
      return { status: 401, message: 'Invalid password' }
    }

    const token = this.generateToken(user)
    const isDev = ENV !== 'production'
    cookies.set(authCookieKey, token, { path: '/', secure: !isDev })

    console.info('Logged in:', user.email)
    return token
  }

  private static isPasswordValid(providedHash: ArrayBuffer, expectedHash: Buffer<ArrayBufferLike>) {
    return expectedHash.equals(Buffer.from(providedHash))
  }

  static async register(email: string, password: string, name: string) {
    const created = await db
      .insert(users)
      .values({
        email,
        passwordHash: Buffer.from(await hash(password)),
        name,
      })
      .returning()

    const user = created.at(0)

    if (!this.isUser(user)) {
      console.error('Failed to create user:', email)
      throw new Error(`Failed to create user '${email}'`)
    }

    return user
  }

  static getDetails(user: User): PublicUser {
    return {
      ...user,
      passwordHash: undefined,
    }
  }
}
