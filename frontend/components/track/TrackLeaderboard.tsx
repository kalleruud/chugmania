import { TimeEntryList } from '@/app/pages/TrackPage'
import { useData } from '@/contexts/DataContext'
import type { ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'
import type { LeaderboardEntry } from '../../../common/models/timeEntry'
import type { Track } from '../../../common/models/track'
import { Spinner } from '../ui/spinner'
import { TrackItem } from './TrackItem'

type TrackLeaderboardProps = {
  track: Track
  session?: string
  user?: string
  highlight?: (e: LeaderboardEntry) => boolean
}

export default function TrackLeaderboard({
  className,
  track,
  session,
  user,
  highlight,
  ...rest
}: Readonly<TrackLeaderboardProps & ComponentProps<'div'>>) {
  const { timeEntries, isLoadingData } = useData()

  if (isLoadingData)
    return (
      <div className='items-center-safe justify-center-safe flex h-dvh w-full'>
        <Spinner className='size-6' />
      </div>
    )

  const entries = timeEntries
    ?.filter(te => !session || session === te.session)
    .filter(te => !user || user === te.user)
    .filter(te => !track || track.id === te.track)

  if (entries.length === 0) return undefined

  return (
    <div
      className={twMerge(
        'bg-background flex flex-col gap-2 rounded-sm border p-2',
        className
      )}
      {...rest}>
      <TrackItem track={track} variant='row' />
      <TimeEntryList
        track={track.id}
        user={user}
        session={session}
        entries={entries}
        highlight={highlight}
      />
    </div>
  )
}
