import { useAuth } from '@/contexts/useAuth'
import { useData } from '@/contexts/useData'
import loc from '@/lib/locales'
import { PlusIcon } from '@heroicons/react/24/solid'
import { Link } from 'react-router'
import { PageSubheader } from '../PageHeader'
import { Button } from '../ui/button'
import { Empty } from '../ui/empty'
import TournamentCard from './TournamentCard'

type TournamentListProps = {
  sessionId: string
}

export default function TournamentList({
  sessionId,
}: Readonly<TournamentListProps>) {
  const { tournaments, isLoadingData } = useData()
  const { isLoggedIn, loggedInUser } = useAuth()

  const canCreate = isLoggedIn && loggedInUser.role !== 'user'

  if (isLoadingData) return null

  const sessionTournaments = tournaments.filter(t => t.session === sessionId)

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex items-center justify-between'>
        <PageSubheader title={loc.no.tournament.title} />

        {canCreate && (
          <Button variant='outline' size='sm' asChild>
            <Link to={`/tournaments/create?session=${sessionId}`}>
              <PlusIcon />
              {loc.no.tournament.new}
            </Link>
          </Button>
        )}
      </div>

      {sessionTournaments.length === 0 && (
        <Empty className='border border-input text-sm text-muted-foreground'>
          {loc.no.common.noItems}
        </Empty>
      )}

      {sessionTournaments.map(tournament => (
        <TournamentCard key={tournament.id} tournament={tournament} />
      ))}
    </div>
  )
}
