import { ISSUER, PRIVATE_KEY, TOKEN_EXPIRY } from '$env/static/private'
import type { ResponseMessage } from '@/components/types.server'
import { hash } from '@/utils'
import { fail, redirect, type ActionFailure, type Cookies } from '@sveltejs/kit'
import jwt from 'jsonwebtoken'
import UserManager, { type PublicUser } from './user.manager'

if (!ISSUER) throw new Error('Missing environment variable: ISSUER')

const authCookieKey = 'auth'
const privateKey: jwt.Secret = PRIVATE_KEY ?? crypto.getRandomValues(new Uint8Array(256))
const jwtOptions: jwt.SignOptions = {
  issuer: ISSUER,
  algorithm: 'HS256',
  expiresIn: TOKEN_EXPIRY,
}

export default class LoginManager {
  static async login(
    form: FormData,
    cookies: Cookies
  ): Promise<ResponseMessage | ActionFailure<ResponseMessage>> {
    const { email, password } = this.getFields(form)
    console.debug('Logging in user:', email)
    if (!password) return fail(400, { success: false, message: 'Password not provided' })

    const user = await UserManager.getUser(email)

    if (!user) return fail(400, { success: false, message: 'User not found' })
    if (!this.isPasswordValid(await hash(password), user.passwordHash)) {
      return fail(400, { success: false, message: 'Incorrect password' })
    }

    const token = jwt.sign(UserManager.getDetails(user), privateKey, jwtOptions)
    cookies.set(authCookieKey, token, {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      secure: false,
    })

    console.info('Logged in:', user.email)
    return { success: true }
  }

  private static isPasswordValid(providedHash: ArrayBuffer, expectedHash: Buffer) {
    return expectedHash.equals(Buffer.from(providedHash))
  }

  static async logout(cookies: Cookies) {
    console.debug('Logging out')
    cookies.delete(authCookieKey, { path: '/' })
    throw redirect(302, '/login')
  }

  static verifyAuth(cookies: Cookies): PublicUser | ActionFailure<ResponseMessage> {
    try {
      const token = cookies.get(authCookieKey)
      if (!token)
        return fail(401, { success: false, message: 'Could not retrieve auth key from cookies' })

      return jwt.verify(token, privateKey, jwtOptions) as PublicUser
    } catch (error) {
      if (!(error instanceof jwt.JsonWebTokenError)) throw error
      return fail(401, { success: false, message: `Failed to verify token: ${error.message}` })
    }
  }

  static async register(form: FormData): Promise<ResponseMessage | ActionFailure<ResponseMessage>> {
    const { email, password, name } = this.getFields(form)
    console.debug('Registering user:', email)
    if (!password) return fail(400, { success: false, message: 'Password not provided' })
    if (!name) return fail(400, { success: false, message: 'Name not provided' })

    try {
      await UserManager.create(email, password, name)
      return { success: true }
    } catch (error) {
      if (!(error instanceof Error)) throw error
      console.error('Failed to register user:', error)
      return fail(400, { success: false, message: error.message })
    }
  }

  private static getFields(data: FormData) {
    const email = data.get('email')?.toString().trim().toLowerCase()
    if (!email) throw new Error('Email not provided')
    return {
      email,
      password: data.get('password')?.valueOf().toLocaleString(),
      name: data.get('name')?.valueOf().toLocaleString(),
    }
  }
}
