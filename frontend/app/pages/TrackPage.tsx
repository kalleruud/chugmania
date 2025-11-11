import TimeEntryItem, {
  type GapType,
} from '@/components/timeentries/TimeEntryItem'
import { TrackItem } from '@/components/track/TrackItem'
import { Empty } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import type { LeaderboardEntry } from '../../../common/models/timeEntry'
import { getRandomItem } from '../utils/utils'

function RowItemList({ entries }: Readonly<{ entries: LeaderboardEntry[] }>) {
  const [gapType, setGapType] = useState<GapType>('leader')

  if (entries.length === 0) {
    return (
      <Empty className='border-input text-muted-foreground border text-sm'>
        {getRandomItem(loc.no.noItems)}
      </Empty>
    )
  }
  return (
    <div className='bg-background-secondary flex flex-col rounded-sm'>
      {entries.map(entry => (
        <TimeEntryItem
          key={entry.id}
          lapTime={entry}
          className='p-4 py-3 first:pt-4 last:pb-4'
          gapType={gapType}
          onChangeGapType={() =>
            setGapType(gapType === 'leader' ? 'interval' : 'leader')
          }
        />
      ))}
    </div>
  )
}

export default function TrackPage() {
  const { id } = useParams()
  const { tracks, leaderboards } = useData()

  if (tracks === undefined || leaderboards === undefined) {
    return (
      <div className='items-center-safe justify-center-safe flex h-dvh w-full'>
        <Spinner className='size-6' />
      </div>
    )
  }

  if (id === undefined) throw new Error('Ingen id')
  if (!(id in tracks)) throw new Error('Banen med denne iden finnes ikke')

  const track = tracks[id]
  const leaderboard = id in leaderboards ? leaderboards[id].entries : []

  return (
    <div className='flex flex-col p-2'>
      <TrackItem track={track} variant='row' />
      <RowItemList entries={leaderboard} />
    </div>
  )
}
