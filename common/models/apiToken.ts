import { isRecord } from '../utils/utils'
import type { SuccessResponse } from './socket.io'

export const MAX_API_TOKENS = 10
export const CALENDAR_TOKEN_NAME = 'calendar'
export const MAX_API_TOKEN_NAME_LENGTH = 64
export const DEFAULT_API_TOKEN_DAYS = 30

export type ApiToken = {
  id: string
  user: string
  name: string
  hint: string
  createdAt: number
  expiresAt: number | null
  lastUsedAt: number | null
}

export type CreateApiTokenRequest = {
  type: 'CreateApiTokenRequest'
  name: string
  expiresAt?: number | null
}

export function isCreateApiTokenRequest(
  data: unknown
): data is CreateApiTokenRequest {
  if (!isRecord(data)) return false
  return (
    data.type === 'CreateApiTokenRequest' &&
    typeof data.name === 'string' &&
    (data.expiresAt === undefined ||
      data.expiresAt === null ||
      typeof data.expiresAt === 'number')
  )
}

export type ApiTokenRequest = {
  type: 'ApiTokenRequest'
  id: string
}

export function isApiTokenRequest(data: unknown): data is ApiTokenRequest {
  if (!isRecord(data)) return false
  return data.type === 'ApiTokenRequest' && typeof data.id === 'string'
}

export type CreateApiTokenResponse = SuccessResponse & {
  token: ApiToken
  value: string
}

export type RevealApiTokenResponse = SuccessResponse & { value: string }

export type CalendarUrlResponse = SuccessResponse & {
  path: string
  created: boolean
}

export function isApiTokenExpired(
  token: Pick<ApiToken, 'expiresAt'>,
  now = Date.now()
): boolean {
  return token.expiresAt !== null && token.expiresAt <= now
}
