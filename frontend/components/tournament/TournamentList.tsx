import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import { PlusIcon } from '@heroicons/react/24/solid'
import { Link } from 'react-router-dom'
import { PageSubheader } from '../PageHeader'
import { Button } from '../ui/button'
import { Empty } from '../ui/empty'
import TournamentView from './TournamentCard'

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
        <Empty className='border-input text-muted-foreground border text-sm'>
          {loc.no.common.noItems}
        </Empty>
      )}

      {sessionTournaments.map(tournament => (
        <TournamentView key={tournament.id} tournament={tournament} />
      ))}
    </div>
  )
}
