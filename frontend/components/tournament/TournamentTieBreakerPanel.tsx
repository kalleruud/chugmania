import { useData } from '@/contexts/DataContext'
import loc from '@common/locale/locales'
import type { TournamentDetails } from '@common/models/tournament'
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
    <section className='flex flex-col gap-2 rounded-sm border bg-background p-4'>
      <h3 className='p-2'>{loc.no.tournament.tieBreakers}</h3>
      <TrackRow item={track} />
      <TimeEntryList entries={details.tieBreakers} filter='all' />
    </section>
  )
}
