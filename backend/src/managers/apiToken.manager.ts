import loc from '@common/locale/locales'
import {
  CALENDAR_TOKEN_NAME,
  DEFAULT_API_TOKEN_DAYS,
  isApiTokenRequest,
  isCreateApiTokenRequest,
  MAX_API_TOKEN_NAME_LENGTH,
  MAX_API_TOKENS,
  type ApiToken,
} from '@common/models/apiToken'
import type { EventReq, EventRes } from '@common/models/socket.io'
import type { User, UserInfo } from '@common/models/user'
import { tryCatchAsync } from '@common/utils/try-catch'
import { DateTime } from 'luxon'
import ApiTokenSource, {
  type ApiTokenRow,
} from '../../database/sources/apiToken.source'
import TransactionSource from '../../database/sources/transaction.source'
import { broadcastApiTokens, type TypedSocket } from '../server'
import AuthManager from './auth.manager'
import UserManager from './user.manager'

type CreateOptions = { name: string; expiresAt?: number | null }

export default class ApiTokenManager {
  private static readonly TOUCH_INTERVAL_MS = 60_000

  private static toDto(row: ApiTokenRow): ApiToken {
    const value = AuthManager.signApiToken(row.user, row.id)
    return {
      id: row.id,
      user: row.user,
      name: row.name,
      hint: `…${value.slice(-6)}`,
      createdAt: row.createdAt.getTime(),
      expiresAt: row.expiresAt?.getTime() ?? null,
      lastUsedAt: row.lastUsedAt?.getTime() ?? null,
    }
  }

  private static isExpired(row: ApiTokenRow, now: Date): boolean {
    return row.expiresAt !== null && row.expiresAt <= now
  }

  static getTokens(viewer: Pick<UserInfo, 'id' | 'role'>): ApiToken[] {
    const rows =
      viewer.role === 'admin'
        ? ApiTokenSource.listAll()
        : ApiTokenSource.listForUser(viewer.id)
    return rows.map(ApiTokenManager.toDto)
  }

  static async emit(socket: TypedSocket, owner?: string): Promise<void> {
    const { data: viewer } = await tryCatchAsync(
      AuthManager.checkAuth(socket, undefined, true)
    )
    if (!viewer) return
    if (owner && viewer.id !== owner && viewer.role !== 'admin') return
    socket.emit('api_tokens', ApiTokenManager.getTokens(viewer))
  }

  static async authenticate(
    raw: string | undefined,
    allowedRoles?: UserInfo['role'][],
    now = new Date()
  ): Promise<UserInfo> {
    const { userId, tokenId } = AuthManager.verifyApiToken(raw)
    const token = ApiTokenSource.findActiveById(tokenId)
    if (
      !token ||
      token.user !== userId ||
      ApiTokenManager.isExpired(token, now)
    )
      throw new Error(loc.no.error.messages.invalid_jwt)
    const user = await AuthManager.authorize(userId, allowedRoles)
    if (
      !token.lastUsedAt ||
      now.getTime() - token.lastUsedAt.getTime() >=
        ApiTokenManager.TOUCH_INTERVAL_MS
    ) {
      ApiTokenSource.touch(token.id, now)
      broadcastApiTokens(token.user)
    }
    return UserManager.toUserInfo(user).userInfo
  }

  private static parseName(name: string): string {
    const trimmed = name.trim()
    if (!trimmed || trimmed.length > MAX_API_TOKEN_NAME_LENGTH)
      throw new Error(loc.no.apiTokens.errors.invalidName)
    return trimmed
  }

  private static parseExpiry(
    expiresAt: number | null | undefined,
    now: Date
  ): Date | null {
    if (expiresAt === null) return null
    if (expiresAt === undefined)
      return DateTime.fromJSDate(now)
        .plus({ days: DEFAULT_API_TOKEN_DAYS })
        .toJSDate()
    if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime())
      throw new Error(loc.no.apiTokens.errors.invalidExpiry)
    return new Date(expiresAt)
  }

  static create(
    owner: Pick<User, 'id' | 'role'>,
    options: CreateOptions,
    now = new Date()
  ): { token: ApiToken; value: string } {
    const name = ApiTokenManager.parseName(options.name)
    const expiresAt = ApiTokenManager.parseExpiry(options.expiresAt, now)
    const row = TransactionSource.run(() => {
      const existing = ApiTokenSource.findByName(owner.id, name)
      if (existing && !ApiTokenManager.isExpired(existing, now))
        throw new Error(loc.no.apiTokens.errors.duplicateName)
      if (
        owner.role !== 'admin' &&
        ApiTokenSource.countActive(owner.id, now) >= MAX_API_TOKENS
      )
        throw new Error(loc.no.apiTokens.errors.limitReached(MAX_API_TOKENS))
      if (existing) ApiTokenSource.revoke(existing.id, now)
      return ApiTokenSource.create({
        user: owner.id,
        name,
        expiresAt,
        createdAt: now,
      })
    })
    broadcastApiTokens(owner.id)
    return {
      token: ApiTokenManager.toDto(row),
      value: AuthManager.signApiToken(row.user, row.id),
    }
  }

  static ensureCalendarToken(
    owner: Pick<User, 'id' | 'role'>,
    now = new Date()
  ): { value: string; created: boolean } {
    const existing = ApiTokenSource.findByName(owner.id, CALENDAR_TOKEN_NAME)
    if (existing && !ApiTokenManager.isExpired(existing, now))
      return {
        value: AuthManager.signApiToken(existing.user, existing.id),
        created: false,
      }
    const { value } = ApiTokenManager.create(
      owner,
      { name: CALENDAR_TOKEN_NAME, expiresAt: null },
      now
    )
    return { value, created: true }
  }

  static async onCreateApiToken(
    socket: TypedSocket,
    request: EventReq<'create_api_token'>
  ): Promise<EventRes<'create_api_token'>> {
    if (!isCreateApiTokenRequest(request))
      throw new Error(
        loc.no.error.messages.invalid_request('CreateApiTokenRequest')
      )
    const owner = await AuthManager.checkAuth(socket)
    const created = ApiTokenManager.create(owner, request)
    console.info(
      new Date().toISOString(),
      socket.id,
      `Created API token '${created.token.name}' for '${owner.email}'`
    )
    return { success: true, ...created }
  }

  static async onRevokeApiToken(
    socket: TypedSocket,
    request: EventReq<'revoke_api_token'>
  ): Promise<EventRes<'revoke_api_token'>> {
    if (!isApiTokenRequest(request))
      throw new Error(loc.no.error.messages.invalid_request('ApiTokenRequest'))
    const actor = await AuthManager.checkAuth(socket, undefined, true)
    const token = ApiTokenSource.findActiveById(request.id)
    if (!token) throw new Error(loc.no.error.messages.not_in_db(request.id))
    if (token.user !== actor.id && actor.role !== 'admin')
      throw new Error(loc.no.error.messages.insufficient_permissions)
    ApiTokenSource.revoke(token.id, new Date())
    console.info(
      new Date().toISOString(),
      socket.id,
      `Revoked API token '${token.name}' (${token.id})`
    )
    broadcastApiTokens(token.user)
    return { success: true }
  }

  static async onRevealApiToken(
    socket: TypedSocket,
    request: EventReq<'reveal_api_token'>
  ): Promise<EventRes<'reveal_api_token'>> {
    if (!isApiTokenRequest(request))
      throw new Error(loc.no.error.messages.invalid_request('ApiTokenRequest'))
    const actor = await AuthManager.checkAuth(socket, undefined, true)
    const token = ApiTokenSource.findActiveById(request.id)
    if (!token) throw new Error(loc.no.error.messages.not_in_db(request.id))
    if (token.user !== actor.id)
      throw new Error(loc.no.error.messages.insufficient_permissions)
    return {
      success: true,
      value: AuthManager.signApiToken(token.user, token.id),
    }
  }

  static async onGetCalendarUrl(
    socket: TypedSocket
  ): Promise<EventRes<'get_calendar_url'>> {
    const owner = await AuthManager.checkAuth(socket)
    const { value, created } = ApiTokenManager.ensureCalendarToken(owner)
    console.info(
      new Date().toISOString(),
      socket.id,
      `${created ? 'Created' : 'Reused'} calendar token for '${owner.email}'`
    )
    const query = new URLSearchParams({ token: value })
    return {
      success: true,
      path: `/api/sessions/calendar.ics?${query.toString()}`,
      created,
    }
  }
}
