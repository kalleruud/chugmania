import MatchList from '@/components/match/MatchList'
import { PageSubheader } from '@/components/PageHeader'
import { TimeEntryList } from '@/components/timeentries/TimeEntryList'
import TrackCard from '@/components/track/TrackCard'
import TrackMedals from '@/components/track/TrackMedals'
import TrackNicknameDialog from '@/components/track/TrackNicknameDialog'
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
import { useData } from '@/contexts/DataContext'
import loc from '@common/locale/locales'
import { getTrackName } from '@common/models/track'
import { useParams } from 'react-router'

const sectionClassName =
  'flex flex-col gap-2 rounded-sm border bg-background p-2 pt-4'

export default function TrackPage() {
  const { id } = useParams()
  const { timeEntries, tracks, matches, isLoadingData } = useData()
  const { isLoggedIn, loggedInUser } = useAuth()
  const canEdit = isLoggedIn && loggedInUser.role !== 'user'

  if (isLoadingData) {
    return (
      <div className='flex h-dvh w-full items-center-safe justify-center-safe'>
        <Spinner className='size-6' />
      </div>
    )
  }

  const track = tracks.find(t => t.id === id)
  if (!track) throw new Error(loc.no.error.messages.not_in_db(`tracks/${id}`))
  const filteredMatches = matches.filter(m => m.track === track.id)

  const entries = timeEntries.filter(te => track.id === te.track)

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
          <BreadcrumbItem className='max-w-full min-w-0'>
            <BreadcrumbPage className='[overflow-wrap:anywhere]'>
              {'#' + getTrackName(track)}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className='flex flex-col gap-2'>
        <TrackCard track={track} />
        {canEdit && <TrackNicknameDialog track={track} />}
      </div>

      <TrackMedals track={track} />

      <div className={sectionClassName}>
        <TimeEntryList track={track.id} entries={entries} />
      </div>

      <div className={sectionClassName}>
        <PageSubheader
          title={loc.no.match.title}
          description={filteredMatches.length.toString()}
        />
        <MatchList matches={filteredMatches} hideTrack />
      </div>
    </div>
  )
}
