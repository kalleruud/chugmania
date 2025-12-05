import { useAuth } from '@/contexts/AuthContext'
import { useTimeEntryDrawer } from '@/hooks/TimeEntryDrawerProvider'
import loc from '@/lib/locales'
import { PlusIcon } from '@heroicons/react/24/solid'
import { useState } from 'react'
import type {
  LeaderboardEntryGap,
  TimeEntry,
} from '../../../common/models/timeEntry'
import { Button } from '../ui/button'
import { Empty } from '../ui/empty'
import type { GapType } from './TimeEntryItem'
import TimeEntryItem from './TimeEntryItem'

type FilterType = 'all' | 'best' | 'latest'

function sortEntries(entries: TimeEntry[]): TimeEntry[] {
  return [...entries].sort((a, b) => {
    // Entries with valid duration first, sorted by lowest duration
    if (a.duration && b.duration) {
      return a.duration - b.duration
    }
    // Entry with duration comes before null/0
    if (a.duration && !b.duration) {
      return -1
    }
    if (!a.duration && b.duration) {
      return 1
    }
    // Both null/0: sort by createdAt (oldest first)
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })
}

function filterEntries(
  entries: TimeEntry[],
  filterType: FilterType
): TimeEntry[] {
  let filtered = entries

  if (filterType === 'best') {
    const bestByUser = new Map<string, TimeEntry>()
    for (const entry of entries) {
      const existing = bestByUser.get(entry.user)
      if (!existing) {
        bestByUser.set(entry.user, entry)
      } else if (entry.duration && existing.duration) {
        if (entry.duration < existing.duration) {
          bestByUser.set(entry.user, entry)
        }
      } else if (entry.duration && !existing.duration) {
        bestByUser.set(entry.user, entry)
      }
    }
    filtered = Array.from(bestByUser.values())
  } else if (filterType === 'latest') {
    const latestByUser = new Map<string, TimeEntry>()
    for (const entry of entries) {
      const existing = latestByUser.get(entry.user)
      if (!existing) {
        latestByUser.set(entry.user, entry)
      } else if (entry.createdAt > existing.createdAt) {
        latestByUser.set(entry.user, entry)
      }
    }
    filtered = Array.from(latestByUser.values())
  }

  return sortEntries(filtered)
}

function getGap(
  i: number,
  entry: TimeEntry,
  compareEntry: TimeEntry | undefined
): LeaderboardEntryGap | undefined {
  if (!entry.duration) return undefined
  return {
    position: i,
    previous: compareEntry
      ? entry.duration - (compareEntry.duration ?? 0)
      : undefined,
  }
}

export type TimeEntryListProps = {
  highlight?: (e: TimeEntry) => boolean
  track?: string
  user?: string
  session?: string
  entries: TimeEntry[]
  filter?: FilterType
}

export function TimeEntryList({
  highlight,
  track,
  user,
  session,
  entries,
  filter = 'best',
}: Readonly<TimeEntryListProps>) {
  const { isLoggedIn } = useAuth()
  const [gapType, setGapType] = useState<GapType>('interval')
  const [filterType, setFilterType] = useState<FilterType>(filter)
  const { open } = useTimeEntryDrawer()

  const filteredEntries = filterEntries(entries, filterType)

  if (filteredEntries.length === 0) {
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
      <div className='flex w-full flex-col gap-1'>
        <div className='flex w-full justify-center gap-1'>
          <Button
            variant={filterType === 'all' ? 'default' : 'outline'}
            size='sm'
            onClick={() => setFilterType('all')}>
            All
          </Button>
          <Button
            variant={filterType === 'best' ? 'default' : 'outline'}
            size='sm'
            onClick={() => setFilterType('best')}>
            Best
          </Button>
          <Button
            variant={filterType === 'latest' ? 'default' : 'outline'}
            size='sm'
            onClick={() => setFilterType('latest')}>
            Latest
          </Button>
        </div>

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
      </div>

      <div className='bg-background-secondary flex flex-col rounded-sm'>
        {filteredEntries.map((entry, i) => {
          return (
            <TimeEntryItem
              key={entry.id}
              lapTime={entry}
              gap={getGap(
                i + 1,
                entry,
                gapType === 'interval'
                  ? filteredEntries.at(i - 1)
                  : filteredEntries.at(0)
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

      {isLoggedIn && (
        <Button
          variant='ghost'
          size='sm'
          className='text-muted-foreground w-fit'
          onClick={() => open({ track, user, session })}>
          <PlusIcon />
          {loc.no.timeEntry.input.create.title}
        </Button>
      )}
    </div>
  )
}
