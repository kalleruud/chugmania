import loc from '@common/locale/locales'
import type { CreateTrack } from '@common/models/track'
import { tryCatchAsync } from '@common/utils/try-catch'

export type TrackMetadata = Omit<
  CreateTrack,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
> & { uid: string }

export type TrackLinkFetcher = {
  hosts: string[]
  fetch: (url: URL) => Promise<TrackMetadata>
}

const TIMEOUT_MS = 10_000

export async function request(
  url: string,
  init?: RequestInit
): Promise<Response | undefined> {
  const { data: response, error } = await tryCatchAsync(
    fetch(url, {
      ...init,
      headers: { 'User-Agent': 'chugmania' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  )
  if (error) throw new Error(loc.no.tracks.import.fetchFailed)
  const isRedirect = response.status >= 300 && response.status < 400
  if (response.status === 404 || isRedirect) return undefined
  if (!response.ok) throw new Error(loc.no.tracks.import.fetchFailed)
  return response
}

export async function requestJson(url: string): Promise<unknown> {
  const response = await request(url)
  if (!response) return undefined
  const { data, error } = await tryCatchAsync<unknown>(response.json())
  if (error) throw new Error(loc.no.tracks.import.fetchFailed)
  return data
}

export function stripFormatting(name: string): string {
  return name
    .replaceAll(/\$[lh]\[[^\]]*\]/gi, '')
    .replaceAll(/\$([0-9a-f]{1,3}|[^$0-9a-f]|\$)/gi, match =>
      match === '$$' ? '$' : ''
    )
    .trim()
}

export function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null
}

export function notFound(): Error {
  return new Error(loc.no.tracks.import.notFound)
}

export function unsupported(): Error {
  return new Error(loc.no.tracks.import.unsupportedLink)
}
