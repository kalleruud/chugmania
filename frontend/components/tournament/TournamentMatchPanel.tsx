import { useTournament } from '@/hooks/useTournament'
import loc from '@common/locale/locales'
import type { SessionWithSignups } from '@common/models/session'
import { pendingMatches } from '@common/utils/tournament'
import { Goal } from 'lucide-react'
import type { ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'
import MatchCard from '../match/MatchCard'
import MatchList from '../match/MatchList'
import { PageHeader } from '../PageHeader'

type TournamentMatchPanelProps = {
  session: SessionWithSignups
  upcomingCount?: number
} & ComponentProps<'section'>

export default function TournamentMatchPanel({
  className,
  session,
  upcomingCount = 2,
  ...props
}: Readonly<TournamentMatchPanelProps>) {
  const { details } = useTournament(session.id)
  if (!details || details.cancelled) return null

  const matches = pendingMatches(details.matches)
  const current = matches.at(0)
  const next = matches.slice(0, upcomingCount)

  if (!current) return null

  return (
    <section className={twMerge('flex flex-col gap-2', className)} {...props}>
      <PageHeader
        title={loc.no.match.live}
        description={session.name}
        to={'/sessions/' + session.id}
        Icon={Goal}
        iconClassName='animate-pulse'
      />

      <MatchCard item={current} />

      {next.length > 0 && (
        <div className='flex flex-col gap-2 pt-2'>
          <h3 className='px-2 text-sm text-muted-foreground'>
            {loc.no.match.next}
          </h3>
          <MatchList matches={next} managed />
        </div>
      )}
    </section>
  )
}
