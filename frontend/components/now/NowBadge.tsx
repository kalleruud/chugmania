import loc from '@common/locale/locales'
import type { QueuedEntry } from '@common/models/activeEntry'
import { Pin } from 'lucide-react'
import { Badge } from '../ui/badge'

export default function NowBadge({ now }: Readonly<{ now: QueuedEntry }>) {
  const pinned = now.source === 'override'
  return (
    <Badge title={pinned ? loc.no.activeEntry.pinned : undefined}>
      {pinned && <Pin aria-hidden />}
      {loc.no.activeEntry.now}
      {pinned && <span className='sr-only'>{loc.no.activeEntry.pinned}</span>}
    </Badge>
  )
}
