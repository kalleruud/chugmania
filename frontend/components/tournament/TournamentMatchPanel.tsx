import { useTournament } from '@/hooks/useTournament'
import type { SessionWithSignups } from '@common/models/session'
import { pendingMatches } from '@common/utils/tournament'
import MatchList from '../match/MatchList'
import { PageHeader } from '../PageHeader'

export default function TournamentMatchPanel({
  session,
}: Readonly<{ session: SessionWithSignups }>) {
  const { details } = useTournament(session.id)
  if (!details || details.cancelled) return null

  const matches = pendingMatches(details.matches).slice(0, 2)
  if (matches.length === 0) return null

  return (
    <section className='flex flex-col gap-2 rounded-sm border bg-background p-2'>
      <PageHeader title={session.name} to={`/sessions/${session.id}`} />
      <MatchList matches={matches} managed featuredMatchId={matches[0].id} />
    </section>
  )
}
