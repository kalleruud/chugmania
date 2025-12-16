import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import type { Match } from '@common/models/match'
import { formatTrackName } from '@common/utils/track'
import { twMerge } from 'tailwind-merge'
import type { BaseRowProps } from '../row/RowProps'
import TrackBadge from '../track/TrackBadge'

export type MatchRowProps = BaseRowProps<Match>

export default function MatchRow({
  className,
  item: match,
  ...rest
}: Readonly<MatchRowProps>) {
  const { users, tracks } = useData()
  const user1 = users?.find(u => u.id === match.user1)
  const user2 = users?.find(u => u.id === match.user2)
  const track = tracks?.find(t => t.id === match.track)

  return (
    <div
      className={twMerge(
        'hover:bg-foreground/5 flex cursor-pointer items-center gap-4 rounded-md px-4 py-3',
        className
      )}
      {...rest}>
      <div className='flex flex-1 items-center gap-2'>
        <span
          className={twMerge(
            'font-f1-bold uppercase',
            match.winner === match.user1 && 'text-primary'
          )}>
          {user1?.firstName ?? loc.no.match.unknownUser}
        </span>
        <span className='text-muted-foreground text-xs'>VS</span>
        <span
          className={twMerge(
            'font-f1-bold uppercase',
            match.winner === match.user2 && 'text-primary'
          )}>
          {user2?.firstName ?? loc.no.match.unknownUser}
        </span>
      </div>

      {track && (
        <div className='flex items-center gap-2'>
          <span className='font-kh-interface tabular-nums'>
            #{formatTrackName(track.number)}
          </span>
          <TrackBadge trackLevel={track.level} size='sm'>
            {track.level}
          </TrackBadge>
        </div>
      )}

      <div className='text-muted-foreground text-sm uppercase tabular-nums'>
        {loc.no.match.status[match.status]}
      </div>
    </div>
  )
}
