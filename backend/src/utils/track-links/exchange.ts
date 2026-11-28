import { isRecord } from '@common/utils/utils'
import {
  notFound,
  num,
  requestJson,
  str,
  stripFormatting,
  unsupported,
  type TrackLinkFetcher,
  type TrackMetadata,
} from './track-link'

const FIELDS = [
  'MapUid',
  'OnlineMapId',
  'Name',
  'Authors',
  'Uploader.Name',
  'MapType',
  'Laps',
  'Medals.Author',
  'Medals.Gold',
  'Medals.Silver',
  'Medals.Bronze',
].join(',')

function authorName(map: Record<string, unknown>): string | null {
  const authors: unknown[] = Array.isArray(map.Authors) ? map.Authors : []
  const [first] = authors
  const author =
    isRecord(first) && isRecord(first.User) ? str(first.User.Name) : null
  const uploader = isRecord(map.Uploader) ? str(map.Uploader.Name) : null
  return author ?? uploader
}

function toMetadata(map: unknown): TrackMetadata | undefined {
  if (!isRecord(map)) return undefined
  const uid = str(map.MapUid)
  const name = str(map.Name)
  if (!uid || !name) return undefined
  const medals = isRecord(map.Medals) ? map.Medals : {}
  const laps = num(map.Laps)
  const mapType = str(map.MapType)
  return {
    game: 'next',
    platform: 'pc',
    level: 'custom',
    environment: 'Stadium',
    uid,
    mapId: str(map.OnlineMapId),
    name: stripFormatting(name),
    author: authorName(map),
    mapType: mapType && `TrackMania\\${mapType}`,
    authorMedalMs: num(medals.Author),
    goldMedalMs: num(medals.Gold),
    silverMedalMs: num(medals.Silver),
    bronzeMedalMs: num(medals.Bronze),
    isLaps: laps === null ? null : laps > 1,
    totalLaps: laps !== null && laps > 1 ? laps : null,
  }
}

export async function fetchExchangeMap(
  key: 'id' | 'uid',
  value: string
): Promise<TrackMetadata | undefined> {
  const params = new URLSearchParams({
    [key]: value,
    count: '1',
    fields: FIELDS,
  })
  const body = await requestJson(
    `https://trackmania.exchange/api/maps?${params}`
  )
  const results: unknown[] =
    isRecord(body) && Array.isArray(body.Results) ? body.Results : []
  return toMetadata(results[0])
}

const exchange: TrackLinkFetcher = {
  hosts: ['trackmania.exchange'],
  async fetch(url) {
    const id = /^\/(?:mapshow|maps)\/(\d+)(?:\/|$)/.exec(url.pathname)?.[1]
    if (!id) throw unsupported()
    const map = await fetchExchangeMap('id', id)
    if (!map) throw notFound()
    return map
  },
}

export default exchange
