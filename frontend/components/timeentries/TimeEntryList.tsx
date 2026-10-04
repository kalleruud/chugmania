import { useAuth } from '@/contexts/AuthContext'
import { useTimeEntryInput } from '@/contexts/TimeEntryInputContext'
import loc from '@common/locale/locales'
import type {
  GapType,
  LeaderboardEntryGap,
  TimeEntry,
} from '@common/models/timeEntry'
import { PlusIcon } from '@heroicons/react/24/solid'
import { Asterisk } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../ui/button'
import { Empty } from '../ui/empty'
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group'
import TimeEntryRow, { Marker } from './TimeEntryRow'

type FilterType = 'all' | 'best' | 'latest'

function sortEntries<T extends TimeEntry>(entries: T[]): T[] {
  return entries.toSorted((a, b) => {
    if ((a.status === 'completed') !== (b.status === 'completed'))
      return a.status === 'completed' ? -1 : 1

    if ((a.status === 'cancelled') !== (b.status === 'cancelled'))
      return a.status === 'cancelled' ? 1 : -1

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

function isBetterEntry<T extends TimeEntry>(current: T, existing: T): boolean {
  if (!current.duration) return false
  if (!existing.duration) return true
  return current.duration < existing.duration
}

function getBestByUser<T extends TimeEntry>(entries: T[]): T[] {
  const bestByUser = new Map<string, T>()
  for (const entry of entries) {
    const existing = bestByUser.get(entry.user)
    if (!existing || isBetterEntry(entry, existing)) {
      bestByUser.set(entry.user, entry)
    }
  }
  return Array.from(bestByUser.values())
}

function getLatestByUser<T extends TimeEntry>(entries: T[]): T[] {
  const latestByUser = new Map<string, T>()
  for (const entry of entries) {
    const existing = latestByUser.get(entry.user)
    if (!existing || entry.createdAt > existing.createdAt) {
      latestByUser.set(entry.user, entry)
    }
  }
  return Array.from(latestByUser.values())
}

function filterEntries<T extends TimeEntry>(
  entries: T[],
  filterType: FilterType
): T[] {
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
  leader?: TimeEntry
): LeaderboardEntryGap | undefined {
  if (entry.status !== 'completed' || !entry.duration) return undefined

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
  entries: (TimeEntry & { required?: boolean })[]
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
      <Empty className='border border-input text-sm text-muted-foreground'>
        <Button
          variant='outline'
          size='sm'
          className='w-fit text-muted-foreground'
          onClick={() => open({ track, user, session })}>
          <PlusIcon />
          {loc.no.timeEntry.input.create.title}
        </Button>
      </Empty>
    )
  }

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex w-full justify-between'>
        <ToggleGroup
          type='single'
          value={filterType}
          onValueChange={value => {
            if (value !== '') setFilterType(value as FilterType)
          }}
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
          onValueChange={value => {
            if (value !== '') setGapType(value as GapType)
          }}
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

      <div className='flex flex-col rounded-sm bg-background-secondary'>
        {filteredEntries.map((entry, i) => {
          return (
            <TimeEntryRow
              key={entry.id}
              item={entry}
              required={entry.required === true}
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

      <div className='flex items-center gap-4'>
        {isLoggedIn && (
          <Button
            variant='ghost'
            size='sm'
            className='mr-auto w-fit text-muted-foreground'
            onClick={() => open({ track, user, session })}>
            <PlusIcon />
            {loc.no.timeEntry.input.create.title}
          </Button>
        )}
        {entries.find(e => e.comment) && (
          <div className='flex gap-1'>
            <Marker show Icon={Asterisk} />
            <p className='line-clamp-1 truncate text-muted-foreground'>
              {loc.no.match.form.comment}
            </p>
          </div>
        )}
        {entries.find(e => e.tieBreaker) && (
          <div className='flex gap-1'>
            <Marker className='text-yellow-500' show Icon={Asterisk} />
            <p className='line-clamp-1 truncate text-muted-foreground'>
              {loc.no.tournament.tieBreakers}
            </p>
          </div>
        )}
        {entries.find(e => e.required) && (
          <div className='flex gap-2'>
            <Marker show symbol='!' />
            <p className='line-clamp-1 truncate text-muted-foreground'>
              {loc.no.tournament.requiredTieBreaker}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
