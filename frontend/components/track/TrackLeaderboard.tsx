import { TimeEntryList } from '@/app/pages/TrackPage'
import type { ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'
import type { LeaderboardEntry } from '../../../common/models/timeEntry'
import type { Track } from '../../../common/models/track'
import { TrackItem } from './TrackItem'

type TrackLeaderboardProps = {
  track: Track
  entries: LeaderboardEntry[]
  session?: string
  user?: string
  highlight?: (e: LeaderboardEntry) => boolean
}

export default function TrackLeaderboard({
  className,
  track,
  entries,
  session,
  user,
  highlight,
  ...rest
}: Readonly<TrackLeaderboardProps & ComponentProps<'div'>>) {
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
        entries={entries}
        user={user}
        session={session}
        highlight={highlight}
      />
    </div>
  )
}
