import { TimeEntryList } from '@/components/timeentries/TimeEntryList'
import TrackCard from '@/components/track/TrackCard'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/contexts/AuthContext'
import { useData, useDataSubscription } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import { formatTrackName } from '@common/utils/track'
import { useParams } from 'react-router-dom'

export default function TrackPage() {
  const { id } = useParams()
  const { isLoggedIn, loggedInUser } = useAuth()
  useDataSubscription(['tracks', 'timeEntries'])
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

      <TrackCard track={track} className='pb-0' />

      <TimeEntryList
        track={track.id}
        entries={entries}
        highlight={e => isLoggedIn && loggedInUser.id === e.user}
      />
    </div>
  )
}
