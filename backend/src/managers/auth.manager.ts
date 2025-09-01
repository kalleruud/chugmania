import {
  isLoginRequest,
  isRegisterRequest,
} from '@chugmania/common/models/requests.js'
import type {
  BackendResponse,
  ErrorResponse,
  LoginSuccessResponse,
  RegisterSuccessResponse,
} from '@chugmania/common/models/responses.js'
import { type User, type UserInfo } from '@chugmania/common/models/user.js'
import { tryCatch, tryCatchAsync } from '@chugmania/common/utils/try-catch.js'
import jwt from 'jsonwebtoken'
import fs from 'node:fs'
import path from 'node:path'
import type { ExtendedError, Socket } from 'socket.io'
import UserManager from './user.manager'
import type { users } from '@database/schema'

const TOKEN_EXPIRY_H = process.env.TOKEN_EXPIRY_H ?? '1'
function loadOrCreateSecret(): jwt.Secret {
  if (process.env.SECRET) return process.env.SECRET
  try {
    const secretFile =
      process.env.SECRET_FILE ?? path.resolve(process.cwd(), 'data/jwt.secret')
    if (fs.existsSync(secretFile)) {
      const raw = fs.readFileSync(secretFile, 'utf8').trim()
      if (raw) return raw
    }
    // create
    const bytes = crypto.getRandomValues(new Uint8Array(64))
    const secret = Buffer.from(bytes).toString('base64')
    fs.mkdirSync(path.dirname(secretFile), { recursive: true })
    fs.writeFileSync(secretFile, secret, 'utf8')
    return secret
  } catch (e) {
    // last resort ephemeral
    return Buffer.from(crypto.getRandomValues(new Uint8Array(64)))
  }
}

const SECRET: jwt.Secret = loadOrCreateSecret()

const tokenExpiryMs = Number.parseFloat(TOKEN_EXPIRY_H) * 60 * 60 * 1000

export default class AuthManager {
  private static readonly JWT_OPTIONS: jwt.SignOptions = {
    algorithm: 'HS512',
    expiresIn: tokenExpiryMs / 1_000,
  }

  private static sign(user: UserInfo) {
    return jwt.sign(user, SECRET, this.JWT_OPTIONS)
  }

  private static verify(token: string | undefined): UserInfo {
    if (!token) throw new Error('No JWT token provided')
    return jwt.verify(token, SECRET) as UserInfo
  }

  private static async isPasswordValid(
    providedPassword: string,
    expectedHash: User['passwordHash']
  ) {
    return expectedHash.equals(await this.hash(providedPassword))
  }

  private static async hash(s: string): Promise<User['passwordHash']> {
    const encoder = new TextEncoder()
    return Buffer.from(await crypto.subtle.digest('SHA-512', encoder.encode(s)))
  }

  static async checkAuth(socket: Socket): Promise<ExtendedError | UserInfo> {
    console.debug(new Date().toISOString(), socket.id, '🔑 Checking auth...')
    const token = socket.handshake.auth.token as string

    if (!token) {
      console.debug(new Date().toISOString(), socket.id, '🔒 No token found')
      return {
        name: 'LoginError',
        message: '',
      } satisfies ExtendedError
    }

    console.debug(new Date().toISOString(), socket.id, '🔓 Found token:', token)

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

    // Basic server-side validation and normalization
    const email = String(request.email).trim().toLowerCase()
    const name = String(request.name).trim()
    const rawShort = (request.shortName ?? null) as string | null
    const shortName =
      rawShort && rawShort.trim().length > 0
        ? rawShort.trim().toUpperCase()
        : null
    const password = String(request.password)

    const emailValid = /.+@.+\..+/.test(email)
    if (!emailValid) {
      return { success: false, message: 'Please provide a valid email' }
    }
    if (name.length < 2) {
      return { success: false, message: 'Name must be at least 2 characters' }
    }
    if (shortName !== null && !/^[A-Z]{3}$/.test(shortName)) {
      return {
        success: false,
        message: 'Short name must be exactly 3 letters (A–Z)',
      }
    }
    if (password.length < 8) {
      return {
        success: false,
        message: 'Password must be at least 8 characters',
      }
    }

    const { data: user, error } = await tryCatchAsync(
      UserManager.createUser({
        email,
        name,
        shortName,
        passwordHash: await this.hash(password),
      } satisfies typeof users.$inferInsert)
    )

    if (error) {
      console.error(new Date().toISOString(), socket.id, error.message)
      return {
        success: false,
        message: error.message,
      } satisfies ErrorResponse
    }

    const { passwordHash: _, ...userInfo } = user
    return {
      success: true,
      token: this.sign(userInfo),
    } satisfies RegisterSuccessResponse
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

    const { passwordHash, ...userInfo } = data

    return (await this.isPasswordValid(password, passwordHash))
      ? ({
          success: true,
          token: this.sign(userInfo),
        } satisfies LoginSuccessResponse)
      : ({
          success: false,
          message: 'Incorrect password',
        } satisfies ErrorResponse)
  }
}
