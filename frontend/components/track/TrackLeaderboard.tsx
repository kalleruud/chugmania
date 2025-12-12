import { useData } from '@/contexts/DataContext'
import type { Track } from '@common/models/track'
import type { ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'
import {
  TimeEntryList,
  type TimeEntryListProps,
} from '../timeentries/TimeEntryList'
import { Spinner } from '../ui/spinner'
import { TrackRow } from './TrackRow'

type TrackLeaderboardProps = {
  track: Track
} & Omit<TimeEntryListProps, 'track' | 'entries'>

export default function TrackLeaderboard({
  className,
  track,
  ...rest
}: Readonly<TrackLeaderboardProps & ComponentProps<'div'>>) {
  const { timeEntries, isLoadingData } = useData()

  if (isLoadingData)
    return (
      <div className='items-center-safe justify-center-safe bg-background flex h-32 w-full flex-col gap-2 rounded-sm border p-2'>
        <Spinner className='size-6' />
      </div>
    )

  const entries = timeEntries
    ?.filter(te => !rest.session || rest.session === te.session)
    .filter(te => !rest.user || rest.user === te.user)
    .filter(te => !track || track.id === te.track)

  if (entries.length === 0) return undefined

  return (
    <div
      className={twMerge(
        'bg-background flex flex-col gap-2 rounded-sm border p-2',
        className
      )}
      {...rest}>
      <TrackRow track={track} />
      <TimeEntryList track={track.id} entries={entries} {...rest} />
    </div>
  )
}
