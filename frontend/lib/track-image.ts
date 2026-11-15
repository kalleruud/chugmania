import type { Track } from '@common/models/track'

export function trackImageUrl(track: Track): string | undefined {
  if (track.game === 'turbo' && track.uid)
    return `https://tmturbo-prod-${track.platform ?? 'pc'}-maps.s3.eu-west-1.amazonaws.com/${track.uid}.jpg`
  if (track.game === 'next' && track.mapId)
    return `https://core.trackmania.nadeo.live/maps/${track.mapId}/thumbnail.jpg`
  return undefined
}
