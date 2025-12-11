import { useAuth } from '@/contexts/AuthContext'
import loc from '@/lib/locales'
import type { LeaderboardEntryGap, TimeEntry } from '@common/models/timeEntry'
import { PlusIcon } from '@heroicons/react/24/solid'
import { useState } from 'react'
import { Button } from '../ui/button'
import { Empty } from '../ui/empty'
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group'
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

function isBetterEntry(current: TimeEntry, existing: TimeEntry): boolean {
  if (!current.duration) return false
  if (!existing.duration) return true
  return current.duration < existing.duration
}

function getBestByUser(entries: TimeEntry[]): TimeEntry[] {
  const bestByUser = new Map<string, TimeEntry>()
  for (const entry of entries) {
    const existing = bestByUser.get(entry.user)
    if (!existing || isBetterEntry(entry, existing)) {
      bestByUser.set(entry.user, entry)
    }
  }
  return Array.from(bestByUser.values())
}

function getLatestByUser(entries: TimeEntry[]): TimeEntry[] {
  const latestByUser = new Map<string, TimeEntry>()
  for (const entry of entries) {
    const existing = latestByUser.get(entry.user)
    if (!existing || entry.createdAt > existing.createdAt) {
      latestByUser.set(entry.user, entry)
    }
  }
  return Array.from(latestByUser.values())
}

function filterEntries(
  entries: TimeEntry[],
  filterType: FilterType
): TimeEntry[] {
  let filtered = entries

  if (filterType === 'best') {
    filtered = getBestByUser(entries)
  } else if (filterType === 'latest') {
    filtered = getLatestByUser(entries)
  }

  return sortEntries(filtered)
}

function getGap(
  i: number,
  entry: TimeEntry,
  compareEntry: TimeEntry | undefined,
  leader: TimeEntry | undefined = undefined
): LeaderboardEntryGap | undefined {
  if (!entry.duration) return undefined

  // For leader gap type, calculate gap to the leader (first entry)
  if (leader) {
    return {
      position: i,
      leader: leader.duration ? entry.duration - leader.duration : undefined,
      previous: undefined,
    }
  }

  // For interval gap type, calculate gap to previous entry
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
  const { open } = useTimeEntryInput()

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
    <div className='flex flex-col gap-3'>
      <div className='flex w-full justify-between'>
        <ToggleGroup
          type='single'
          value={filterType}
          onValueChange={value => setFilterType(value as FilterType)}
          variant='outline'
          size='sm'>
          <ToggleGroupItem value='all' aria-label='Show all entries'>
            All
          </ToggleGroupItem>
          <ToggleGroupItem value='best' aria-label='Show best entry per user'>
            Best
          </ToggleGroupItem>
          <ToggleGroupItem
            value='latest'
            aria-label='Show latest entry per user'>
            Latest
          </ToggleGroupItem>
        </ToggleGroup>

        <ToggleGroup
          type='single'
          value={gapType}
          onValueChange={value => setGapType(value as GapType)}
          variant='outline'
          size='sm'>
          <ToggleGroupItem value='leader' aria-label='Gap to leader'>
            {loc.no.timeEntry.gap.leader}
          </ToggleGroupItem>
          <ToggleGroupItem value='interval' aria-label='Gap to previous'>
            {loc.no.timeEntry.gap.interval}
          </ToggleGroupItem>
        </ToggleGroup>
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
                gapType === 'interval' ? filteredEntries.at(i - 1) : undefined,
                gapType === 'leader' ? filteredEntries.at(0) : undefined
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
