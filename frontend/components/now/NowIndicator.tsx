import loc from '@common/locale/locales'
import { Badge } from '../ui/badge'

export default function NowIndicator() {
  return (
    <Badge className='shrink-0 gap-1 px-1.5'>
      <span
        aria-hidden
        className='size-1.5 rounded-full bg-current motion-safe:animate-pulse'
      />
      {loc.no.activeEntry.now}
    </Badge>
  )
}
