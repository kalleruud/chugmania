import type { useConnection } from '@/contexts/ConnectionContext'
import loc from '@common/locale/locales'
import {
  isApiTokenExpired,
  MAX_API_TOKENS,
  type ApiToken,
} from '@common/models/apiToken'
import type { UserInfo } from '@common/models/user'
import { DEFAULT_LOCALE, DEFAULT_ZONE } from '@common/utils/date'
import { DateTime } from 'luxon'
import { toast } from 'sonner'

type Socket = ReturnType<typeof useConnection>['socket']

export function getOwnActiveTokens(
  tokens: ApiToken[] | undefined,
  user: Pick<UserInfo, 'id'>
): ApiToken[] {
  return (tokens ?? []).filter(
    token => token.user === user.id && !isApiTokenExpired(token)
  )
}

export function isAtTokenLimit(
  tokens: ApiToken[] | undefined,
  user: Pick<UserInfo, 'id' | 'role'>
): boolean {
  return (
    user.role !== 'admin' &&
    getOwnActiveTokens(tokens, user).length >= MAX_API_TOKENS
  )
}

export function formatTokenDate(millis: number): string {
  return DateTime.fromMillis(millis, { zone: DEFAULT_ZONE })
    .setLocale(DEFAULT_LOCALE)
    .toFormat('dd.MM.yyyy')
}

export async function revokeApiToken(socket: Socket, id: string) {
  const request = socket
    .emitWithAck('revoke_api_token', { type: 'ApiTokenRequest', id })
    .then(r => {
      if (!r.success) throw new Error(r.message)
      return r
    })
  toast.promise(request, loc.no.apiTokens.revokeRequest)
  return request
}

export async function copyToClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(loc.no.apiTokens.copied)
    return true
  } catch {
    return false
  }
}
