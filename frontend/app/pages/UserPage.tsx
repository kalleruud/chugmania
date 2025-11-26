import { PageHeader } from '@/app/components/PageHeader'
import TimeEntryItem from '@/components/timeentries/TimeEntryItem'
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
import type { TimeEntry } from '../../../common/models/timeEntry'
import { getUserFullName } from '../../../common/models/user'
import { formatTrackName } from '../../../common/utils/track'

export default function UserPage() {
  const { id } = useParams()
  const { users, tracks } = useData()
  const { socket } = useConnection()
  const [userLaptimes, setUserLaptimes] = useState<
    | Record<
        string,
        { entries: (TimeEntry & { position: number })[]; trackNumber: string }
      >
    | undefined
  >(undefined)

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

  // Fetch absolute time entries for the user on component mount
  useEffect(() => {
    socket
      .emitWithAck('get_absolute_time_entries', id)
      .then((response: any) => {
        if (response.success && tracks) {
          const entriesByTrack: Record<
            string,
            {
              entries: (TimeEntry & { position: number })[]
              trackNumber: string
            }
          > = {}

          for (const [trackId, entries] of Object.entries(response.entries)) {
            const track = tracks[trackId]
            if (!track) continue

            entriesByTrack[trackId] = {
              entries: entries as (TimeEntry & { position: number })[],
              trackNumber: formatTrackName(track.number),
            }
          }

          setUserLaptimes(entriesByTrack)
        }
      })
  }, [id, socket, tracks])

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

      {userLaptimes && Object.keys(userLaptimes).length > 0 && (
        <div className='flex flex-col gap-4'>
          {Object.entries(userLaptimes).map(
            ([trackId, { entries, trackNumber }]) => (
              <div key={trackId} className='flex flex-col gap-2'>
                <PageHeader title={`#${trackNumber}`} icon='FireIcon' />
                <div className='bg-card flex flex-col gap-1 rounded-md p-2'>
                  {entries.map((entry, idx) => (
                    <TimeEntryItem
                      key={`${trackId}-${idx}`}
                      lapTime={{
                        ...entry,
                        gap: { position: entry.position },
                      }}
                      position={entry.position}
                      onChangeGapType={() => {}}
                      className='px-2 py-1'
                    />
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}
