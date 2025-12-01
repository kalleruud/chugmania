import { TrackItem } from '@/components/track/TrackItem'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Spinner } from '@/components/ui/spinner'
import UserItem from '@/components/user/UserItem'
import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import type { LeaderboardEntry } from '../../../common/models/timeEntry'
import type { Track } from '../../../common/models/track'
import { getUserFullName } from '../../../common/models/user'
import { RowItemList } from './TrackPage'

function groupByTrack(
  entries: LeaderboardEntry[],
  tracks: Record<string, Track>
): { track: Track; entries: LeaderboardEntry[] }[] {
  const grouped: Record<string, LeaderboardEntry[]> = {}

  // Group entries by track ID
  for (const entry of entries) {
    // The server returns full TimeEntry which includes track, so we cast to access it
    const trackId = (entry as any).track as string
    if (!grouped[trackId]) {
      grouped[trackId] = []
    }
    grouped[trackId].push(entry)
  }

  // Convert to array and include track data
  return Object.entries(grouped)
    .map(([trackId, trackEntries]) => ({
      track: tracks[trackId],
      entries: trackEntries,
    }))
    .filter(item => item.track !== undefined)
    .sort((a, b) => a.track.number - b.track.number)
}

export default function UserPage() {
  const { id } = useParams()
  const { users, tracks } = useData()
  const { socket } = useConnection()
  const [entries, setEntries] = useState<LeaderboardEntry[] | undefined>(
    undefined
  )

  useEffect(() => {
    if (!id) return
    // TODO: Handle receiving updates on update
    socket
      .emitWithAck('get_absolute_time_entries', {
        type: 'AbsoluteTimeEntriesRequest',
        user: id,
      })
      .then(response => {
        if (!response.success) return toast.error(response.message)
        setEntries(response.entries)
      })
  }, [id, socket, tracks, users])

  if (users === undefined) {
    return (
      <div className='items-center-safe justify-center-safe flex h-dvh w-full'>
        <Spinner className='size-6' />
      </div>
    )
  }

  if (id === undefined)
    throw new Error(loc.no.error.messages.not_in_db('user/:id'))
  if (!(id in users))
    throw new Error(loc.no.error.messages.not_in_db('user/' + id))

  const user = users[id]
  const fullName = getUserFullName(user)

  const groupedTracks = entries && tracks ? groupByTrack(entries, tracks) : []

  return (
    <div className='flex flex-col gap-12'>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink to='/'>{loc.no.common.home}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink to='/users'>{loc.no.users.title}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{fullName}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <UserItem variant='card' user={user} />

      <div className='flex flex-col'>
        {entries && (
          <div className='flex flex-col gap-4'>
            {groupedTracks.map(({ track, entries }) => (
              <div
                key={track.id}
                className='bg-background gap-2 rounded-sm border p-2'>
                <TrackItem variant='row' track={track} />
                <RowItemList track={track} entries={entries} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
