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
  entries: LeaderboardEntry[]
): { track: Track; entries: LeaderboardEntry[] }[] {
  // TODO: Implement grouping
  return []
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
    socket
      .emitWithAck('get_absolute_time_entries', {
        type: 'AbsoluteTimeEntriesRequest',
        user: id,
      })
      .then(response => {
        if (!response.success) return toast.error(response.message)
        setEntries(response.entries)
      })
  }, [id, socket, tracks])

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

  const groupedTracks = entries ? groupByTrack(entries) : []

  return (
    <div className='p-safe-or-2 flex flex-col gap-4'>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink to='/'>{loc.no.home}</BreadcrumbLink>
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

      {entries && (
        <div className='flex flex-col gap-4'>
          {groupedTracks.map(({ track, entries }) => (
            <div key={track.id}>
              <TrackItem variant='card' track={track} />
              <RowItemList track={track} entries={entries} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
