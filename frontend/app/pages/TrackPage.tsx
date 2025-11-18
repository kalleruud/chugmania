import TimeEntryItem, {
  type GapType,
} from '@/components/timeentries/TimeEntryItem'
import { TrackItem } from '@/components/track/TrackItem'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Empty } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { useData } from '@/contexts/DataContext'
import { useTimeEntryDrawer } from '@/hooks/TimeEntryDrawerProvider'
import loc from '@/lib/locales'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import type { LeaderboardEntry } from '../../../common/models/timeEntry'
import type { Track } from '../../../common/models/track'
import { formatTrackName } from '../../../common/utils/track'

function RowItemList({
  track,
  entries,
}: Readonly<{ track: Track; entries: LeaderboardEntry[] }>) {
  const [gapType, setGapType] = useState<GapType>('interval')
  const { open } = useTimeEntryDrawer()

  if (entries.length === 0) {
    return (
      <Empty className='border-input text-muted-foreground border text-sm'>
        {loc.no.noItems}
      </Empty>
    )
  }
  return (
    <>
      <div className='flex w-full justify-center'>
        <ButtonGroup>
          <Button
            className='rounded-l-full'
            variant={gapType === 'leader' ? 'default' : 'outline'}
            size='sm'
            onClick={() => setGapType('leader')}>
            {loc.no.timeEntry.gap.leader}
          </Button>
          <Button
            className='rounded-r-full'
            variant={gapType === 'interval' ? 'default' : 'outline'}
            size='sm'
            onClick={() => setGapType('interval')}>
            {loc.no.timeEntry.gap.interval}
          </Button>
        </ButtonGroup>
      </div>
      <div className='bg-background-secondary flex flex-col rounded-sm'>
        {entries.map(entry => (
          <TimeEntryItem
            key={entry.id}
            lapTime={entry}
            onClick={() => open({ track: track.id, ...entry })}
            className='p-4 py-3 first:pt-4 last:pb-4'
            gapType={gapType}
            onChangeGapType={() =>
              setGapType(gapType === 'leader' ? 'interval' : 'leader')
            }
          />
        ))}
      </div>
    </>
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
    <div className='p-safe-or-2 flex flex-col gap-4'>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink to='/'>{loc.no.home}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink to='/tracks'>{loc.no.tracks.title}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>
              {'#' + formatTrackName(track.number)}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <TrackItem track={track} variant='card' className='pb-0' />
      <RowItemList track={track} entries={leaderboard} />
    </div>
  )
}
