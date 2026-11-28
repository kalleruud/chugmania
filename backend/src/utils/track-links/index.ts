import exchange from './exchange'
import { unsupported, type TrackMetadata } from './track-link'
import trackmania from './trackmania'
import turbo from './turbo'

export type { TrackMetadata } from './track-link'

const fetchers = [turbo, trackmania, exchange]

export function fetchTrackFromLink(link: string): Promise<TrackMetadata> {
  const url = URL.parse(link.trim())
  if (url?.protocol !== 'https:' && url?.protocol !== 'http:')
    throw unsupported()
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  const fetcher = fetchers.find(f => f.hosts.includes(host))
  if (!fetcher) throw unsupported()
  return fetcher.fetch(url)
}
