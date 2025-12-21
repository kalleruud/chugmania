import MatchList from '@/components/match/MatchList'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
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
  const { timeEntries, matches, isLoadingData } = useData()

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

  const filteredMatches = matches
    ?.filter(m => !rest.session || rest.session === m.session)
    .filter(m => !rest.user || rest.user === m.user1 || rest.user === m.user2)
    .filter(m => !track || track.id === m.track)

  if (
    (!entries || entries.length === 0) &&
    (!filteredMatches || filteredMatches.length === 0)
  )
    return undefined

  return (
    <div
      className={twMerge(
        'bg-background flex flex-col gap-2 rounded-sm border p-2',
        className
      )}>
      <TrackRow item={track} />
      <Tabs defaultValue={entries.length > 0 ? 'laptimes' : 'matches'}>
        <TabsList className='w-full'>
          <TabsTrigger value='laptimes'>{loc.no.timeEntry.title}</TabsTrigger>
          <TabsTrigger value='matches'>{loc.no.match.title}</TabsTrigger>
        </TabsList>
        <TabsContent value='laptimes'>
          <TimeEntryList track={track.id} entries={entries ?? []} {...rest} />
        </TabsContent>
        <TabsContent value='matches'>
          <MatchList matches={filteredMatches} layout='list' />
        </TabsContent>
      </Tabs>
    </div>
  )
}
