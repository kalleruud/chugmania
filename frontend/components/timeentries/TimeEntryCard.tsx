import { useData } from '@/contexts/DataContext'
import { useActiveEntries } from '@/hooks/useActiveEntries'
import loc from '@common/locale/locales'
import type { TimeEntry } from '@common/models/timeEntry'
import { getUserFullName } from '@common/models/user'
import { formatTime } from '@common/utils/time'
import type { ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'
import NowButton from '../now/NowButton'
import { TrackRow } from '../track/TrackRow'
import { Badge } from '../ui/badge'
import { NameCellPart } from './TimeEntryRow'

type TimeEntryCardProps = {
  item: TimeEntry
  highlight?: boolean
  compact?: boolean
} & ComponentProps<'div'>

export default function TimeEntryCard({
  item: entry,
  highlight,
  compact,
  className,
  ...props
}: Readonly<TimeEntryCardProps>) {
  const { users, tracks } = useData()
  const now = useActiveEntries().getNow('timeEntry', entry.id)
  const user = users?.find(user => user.id === entry.user)
  const track =
    entry.track === null
      ? null
      : tracks?.find(track => track.id === entry.track)

  return (
    <div
      className={twMerge(
        'group relative flex cursor-pointer flex-col rounded-sm transition-colors',
        compact ? 'gap-4 p-4 sm:p-6' : 'gap-6 p-6 sm:p-8',
        className,
        highlight &&
          'border border-primary/40 bg-primary/10 hover:bg-primary/12'
      )}
      {...props}>
      <div
        className={twMerge(
          'flex items-center justify-center gap-2',
          compact ? 'py-2' : 'py-4'
        )}>
        <NameCellPart
          name={user ? getUserFullName(user) : loc.no.match.unknownUser}
          className='text-lg whitespace-normal sm:text-3xl'
        />
        {entry.tieBreaker && (
          <span className='font-f1-bold text-yellow-500'>*</span>
        )}
      </div>
      <div className='flex flex-col gap-4 border-t border-primary/20 pt-4'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div className='flex items-center gap-2'>
            {now && !compact && <Badge>{loc.no.activeEntry.now}</Badge>}
            {now?.source === 'override' && (
              <Badge variant='outline'>{loc.no.activeEntry.pinned}</Badge>
            )}
          </div>
          <div className='flex items-center gap-2'>
            <span className='text-sm text-muted-foreground'>
              {loc.no.common.status[entry.status]}
            </span>
            <NowButton
              kind='timeEntry'
              entry={entry}
              showLabel
              subject={user ? getUserFullName(user) : loc.no.match.unknownUser}
            />
          </div>
        </div>
        {track !== undefined && (
          <TrackRow item={track} hideLink className='p-0' />
        )}
        {entry.duration !== null && (
          <div>
            <p className='text-sm text-muted-foreground'>
              {loc.no.match.duration}
            </p>
            <p className='font-kh-interface text-xl tabular-nums'>
              {formatTime(entry.duration)}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
