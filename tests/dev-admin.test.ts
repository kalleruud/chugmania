import UserManager, { DEV_ADMIN } from '@backend/src/managers/user.manager'
import { describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { users } from '../backend/database/schema'
import AuthManager from '../backend/src/managers/auth.manager'
import type { TypedSocket } from '../backend/src/server'
import { db } from './setup'

describe('development admin', () => {
  test.serial('is created once and can log in as admin', async () => {
    await UserManager.ensureDevAdmin()
    await UserManager.ensureDevAdmin()

    const rows = db
      .select()
      .from(users)
      .where(eq(users.email, DEV_ADMIN.email))
      .all()
    expect(rows).toHaveLength(1)
    expect(rows[0].role).toBe('admin')

    const socket = { id: 'dev-admin', handshake: { auth: {} } } as TypedSocket
    const response = await AuthManager.onLogin(socket, {
      type: 'LoginRequest',
      email: DEV_ADMIN.email,
      password: DEV_ADMIN.password,
    })
    expect(response.success).toBe(true)
  })
})
