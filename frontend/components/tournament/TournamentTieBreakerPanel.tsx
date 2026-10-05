import { useData } from '@/contexts/DataContext'
import loc from '@common/locale/locales'
import type { TournamentDetails } from '@common/models/tournament'
import { ChevronDown } from 'lucide-react'
import { TimeEntryList } from '../timeentries/TimeEntryList'
import { TrackRow } from '../track/TrackRow'

export default function TournamentTieBreakerPanel({
  details,
}: {
  details: TournamentDetails
}) {
  const { tracks } = useData()
  const track = tracks?.find(t => t.id === details.config.tieBreakerTrack)

  if (!details.tieBreakers.length) return null

  return (
    <details
      open={details.tieBreakers.some(lap => lap.status === 'planned')}
      className='group/tie-breakers rounded-sm border bg-background p-4'>
      <summary className='flex cursor-pointer list-none items-center justify-between gap-2 p-2 [&::-webkit-details-marker]:hidden'>
        <h3>{loc.no.tournament.tieBreakers}</h3>
        <ChevronDown
          aria-hidden
          className='size-4 shrink-0 transition-transform group-open/tie-breakers:rotate-180'
        />
      </summary>
      <div className='flex flex-col gap-2'>
        <TrackRow item={track} />
        <TimeEntryList entries={details.tieBreakers} filter='all' />
      </div>
    </details>
  )
}
