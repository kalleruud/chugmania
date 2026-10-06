import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import loc from '@common/locale/locales'
import type { Match } from '@common/models/match'
import type { SessionWithSignups } from '@common/models/session'
import { pendingMatches } from '@common/utils/tournament'
import { Radio } from 'lucide-react'
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
  const { tournaments } = useData()
  const details = tournaments?.find(t => t.config.session === session.id)
  const { isLoggedIn, loggedInUser } = useAuth()
  if (!details || details.status === 'draft' || details.cancelled) return null

  const matches = pendingMatches(details.matches)
  const current = matches.at(0)
  const next = matches.slice(1, upcomingCount + 1)

  const isMe = (match: Match | null | undefined) =>
    isLoggedIn &&
    !!match &&
    (loggedInUser.id === match.user1 || loggedInUser.id === match.user2)

  if (!current) return null

  return (
    <section className={twMerge('flex flex-col gap-2', className)} {...props}>
      <PageHeader
        title={loc.no.match.live}
        description={session.name}
        to={'/sessions/' + session.id}
        Icon={Radio}
        iconClassName='animate-pulse'
      />

      <MatchCard item={current} highlight={isMe(current)} />

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
