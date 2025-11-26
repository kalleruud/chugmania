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
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import type { LeaderboardEntry } from '../../../common/models/timeEntry'
import { getUserFullName } from '../../../common/models/user'
import { formatTrackName } from '../../../common/utils/track'

export default function UserPage() {
  const { id } = useParams()
  const { users, leaderboards, tracks } = useData()

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

  const userLaptimes = useMemo(() => {
    if (!leaderboards || !tracks) return undefined

    const laptimesByTrack: Record<
      string,
      { entries: LeaderboardEntry[]; trackNumber: string }
    > = {}
    let position = 1

    // Iterate through all leaderboards and collect lap times for this user
    for (const trackId of Object.keys(leaderboards)) {
      const leaderboard = leaderboards[trackId]
      const track = tracks[trackId]
      if (!track) continue

      const userEntries = leaderboard.entries.filter(e => e.user === id)
      if (userEntries.length === 0) continue

      laptimesByTrack[trackId] = {
        entries: userEntries.map(entry => ({
          ...entry,
          gap: { position },
        })),
        trackNumber: formatTrackName(track.number),
      }

      position += userEntries.length
    }

    return laptimesByTrack
  }, [id, leaderboards, tracks])

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
                      lapTime={entry}
                      position={entry.gap.position}
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
