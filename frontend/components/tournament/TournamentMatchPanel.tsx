import { useTournament } from '@/hooks/useTournament'
import loc from '@common/locale/locales'
import type { SessionWithSignups } from '@common/models/session'
import { pendingMatches } from '@common/utils/tournament'
import MatchList from '../match/MatchList'
import { PageHeader } from '../PageHeader'

export default function TournamentMatchPanel({
  session,
}: Readonly<{ session: SessionWithSignups }>) {
  const { details } = useTournament(session.id)
  if (!details || details.cancelled) return null

  const matches = pendingMatches(details.matches)
  const current = matches.at(0)
  const next = matches.at(1)
  if (!current) return null

  return (
    <section className='flex flex-col gap-2 rounded-sm border bg-background p-2'>
      <h2 className='flex items-center gap-2 px-2 pt-2 text-primary'>
        <span
          aria-hidden
          className='size-2 animate-pulse rounded-full bg-red-500'
        />
        {loc.no.match.live}
      </h2>
      <PageHeader title={session.name} to={`/sessions/${session.id}`} />
      <MatchList matches={[current]} managed featuredMatchId={current.id} />
      {next && (
        <div className='flex flex-col gap-2 pt-2'>
          <h3 className='px-2 text-sm text-muted-foreground'>
            {loc.no.match.next}
          </h3>
          <MatchList matches={[next]} managed />
        </div>
      )}
    </section>
  )
}
