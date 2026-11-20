import { useData } from '@/contexts/DataContext'
import { useActiveEntries } from '@/hooks/useActiveEntries'
import loc from '@common/locale/locales'
import type { TimeEntry } from '@common/models/timeEntry'
import { getUserFullName } from '@common/models/user'
import type { ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'
import NowBadge from '../now/NowBadge'
import NowButton from '../now/NowButton'
import { TrackRow } from '../track/TrackRow'
import { Marker, NameCellPart, TimePart } from './TimeEntryRow'

type TimeEntryCardProps = {
  item: TimeEntry
  hideTrack?: boolean
} & ComponentProps<'div'>

export default function TimeEntryCard({
  item: entry,
  hideTrack,
  className,
  ...props
}: Readonly<TimeEntryCardProps>) {
  const { users, tracks } = useData()
  const now = useActiveEntries().getNow('timeEntry', entry.id)
  const user = users?.find(user => user.id === entry.user)
  const name = user ? getUserFullName(user) : loc.no.match.unknownUser
  const track =
    entry.track === null
      ? null
      : tracks?.find(track => track.id === entry.track)

  return (
    <div
      className={twMerge(
        'group relative flex cursor-pointer flex-col gap-3 rounded-sm p-3 transition-colors sm:p-4',
        className,
        now && 'border-l-2 border-primary bg-primary/5 hover:bg-primary/8'
      )}
      {...props}>
      <div className='flex items-center gap-2'>
        {now && <NowBadge now={now} />}
        <span className='mr-auto' />
        <NowButton kind='timeEntry' entry={entry} subject={name} />
      </div>
      <div className='flex items-center gap-4 py-1'>
        <NameCellPart
          name={name}
          className='min-w-0 text-lg whitespace-normal sm:text-2xl'
        />
        <Marker
          className='-ml-3 text-yellow-500'
          show={entry.tieBreaker}
          symbol='*'
        />
        <span className='mr-auto' />
        <div className='text-lg sm:text-2xl'>
          <TimePart duration={entry.duration} status={entry.status} />
        </div>
      </div>
      {track !== undefined && !hideTrack && (
        <div className='border-t border-primary/20 pt-3'>
          <TrackRow item={track} hideLink className='p-0' />
        </div>
      )}
    </div>
  )
}
