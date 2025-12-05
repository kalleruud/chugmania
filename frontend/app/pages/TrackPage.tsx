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
import { Empty } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useTimeEntryDrawer } from '@/hooks/TimeEntryDrawerProvider'
import loc from '@/lib/locales'
import { PlusIcon } from '@heroicons/react/24/solid'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import type {
  LeaderboardEntryGap,
  TimeEntry,
} from '../../../common/models/timeEntry'
import { formatTrackName } from '../../../common/utils/track'

function getGap(
  i: number,
  entry: TimeEntry,
  compareEntry: TimeEntry | undefined
): LeaderboardEntryGap | undefined {
  if (!entry.duration) return undefined
  return {
    position: i,
    previous: compareEntry
      ? (entry.duration ?? 0 - (compareEntry.duration ?? 0))
      : undefined,
  }
}

export function TimeEntryList({
  highlight,
  track,
  user,
  session,
  entries,
}: Readonly<{
  highlight?: (e: TimeEntry) => boolean
  track?: string
  user?: string
  session?: string
  entries: TimeEntry[]
}>) {
  const [gapType, setGapType] = useState<GapType>('interval')
  const { open } = useTimeEntryDrawer()

  if (entries.length === 0) {
    return (
      <Empty className='border-input text-muted-foreground border text-sm'>
        <Button
          variant='outline'
          size='sm'
          className='text-muted-foreground w-fit'
          onClick={() => open({ track, user, session })}>
          <PlusIcon />
          {loc.no.timeEntry.input.create.title}
        </Button>
      </Empty>
    )
  }

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex w-full justify-center gap-1'>
        <Button
          variant={gapType === 'leader' ? 'default' : 'outline'}
          size='sm'
          onClick={() => setGapType('leader')}>
          {loc.no.timeEntry.gap.leader}
        </Button>
        <Button
          variant={gapType === 'interval' ? 'default' : 'outline'}
          size='sm'
          onClick={() => setGapType('interval')}>
          {loc.no.timeEntry.gap.interval}
        </Button>
      </div>

      <div className='bg-background-secondary flex flex-col rounded-sm'>
        {entries.map((entry, i) => {
          return (
            <TimeEntryItem
              key={entry.id}
              lapTime={entry}
              gap={getGap(
                i,
                entry,
                gapType === 'interval' ? entries.at(i - 1) : entries.at(0)
              )}
              onClick={() => open(entry)}
              className='px-4 py-3'
              gapType={gapType}
              onChangeGapType={() =>
                setGapType(gapType === 'leader' ? 'interval' : 'leader')
              }
              highlight={highlight?.(entry)}
            />
          )
        })}
      </div>

      <Button
        variant='ghost'
        size='sm'
        className='text-muted-foreground w-fit'
        onClick={() => open({ track, user, session })}>
        <PlusIcon />
        {loc.no.timeEntry.input.create.title}
      </Button>
    </div>
  )
}

export default function TrackPage() {
  const { id } = useParams()
  const { isLoggedIn, loggedInUser } = useAuth()
  const { timeEntries, tracks, isLoadingData } = useData()

  if (isLoadingData) {
    return (
      <div className='items-center-safe justify-center-safe flex h-dvh w-full'>
        <Spinner className='size-6' />
      </div>
    )
  }

  const track = tracks.find(t => t.id === id)
  if (!track) throw new Error(loc.no.error.messages.not_in_db('track/' + id))

  const entries = timeEntries?.filter(te => !track || track.id === te.track)

  return (
    <div className='flex flex-col gap-4'>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink to='/'>{loc.no.common.home}</BreadcrumbLink>
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

      <TimeEntryList
        track={track.id}
        entries={entries}
        highlight={e => isLoggedIn && loggedInUser.id === e.user}
      />
    </div>
  )
}
