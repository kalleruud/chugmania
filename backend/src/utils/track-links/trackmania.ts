import { tryCatchAsync } from '@common/utils/try-catch'
import { isRecord } from '@common/utils/utils'
import { fetchExchangeMap } from './exchange'
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

async function fetchTrackmaniaIoMap(
  uid: string
): Promise<TrackMetadata | undefined> {
  const { data: map } = await tryCatchAsync(
    requestJson(`https://trackmania.io/api/map/${encodeURIComponent(uid)}`)
  )
  if (!isRecord(map)) return undefined
  const name = str(map.name)
  if (!name || str(map.mapUid) !== uid) return undefined
  const author = isRecord(map.authorplayer) ? str(map.authorplayer.name) : null
  return {
    game: 'next',
    platform: 'pc',
    level: 'custom',
    environment: str(map.collectionName) ?? 'Stadium',
    uid,
    mapId: str(map.mapId),
    name: stripFormatting(name),
    author,
    mapType: str(map.mapType),
    authorMedalMs: num(map.authorScore),
    goldMedalMs: num(map.goldScore),
    silverMedalMs: num(map.silverScore),
    bronzeMedalMs: num(map.bronzeScore),
  }
}

const trackmania: TrackLinkFetcher = {
  hosts: ['trackmania.com'],
  async fetch(url) {
    const uid = /^\/tracks\/([\w-]+)\/?$/.exec(url.pathname)?.[1]
    if (!uid) throw unsupported()
    const exchange = await tryCatchAsync(fetchExchangeMap('uid', uid))
    const map = exchange.data ?? (await fetchTrackmaniaIoMap(uid))
    if (map) return map
    throw exchange.error ?? notFound()
  },
}

export default trackmania
