import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import { PlusIcon } from '@heroicons/react/24/solid'
import { useState } from 'react'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog'
import { Empty } from '../ui/empty'
import TournamentCard from './TournamentCard'
import TournamentForm from './TournamentForm'

type TournamentListProps = {
  sessionId: string
}

export default function TournamentList({
  sessionId,
}: Readonly<TournamentListProps>) {
  const { tournaments, isLoadingData } = useData()
  const { isLoggedIn, loggedInUser } = useAuth()
  const [dialogOpen, setDialogOpen] = useState(false)

  const canCreate = isLoggedIn && loggedInUser.role !== 'user'

  if (isLoadingData) return null

  const sessionTournaments = tournaments.filter(t => t.session === sessionId)

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex items-center justify-between'>
        <h3 className='font-f1-bold text-sm uppercase'>
          {loc.no.tournament.title}
        </h3>
        {canCreate && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant='outline' size='sm'>
                <PlusIcon className='size-4' />
                {loc.no.tournament.new}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{loc.no.tournament.new}</DialogTitle>
              </DialogHeader>
              <TournamentForm
                sessionId={sessionId}
                onSuccess={() => setDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {sessionTournaments.length === 0 && (
        <Empty className='border-input text-muted-foreground border text-sm'>
          {canCreate && (
            <Button
              variant='outline'
              size='sm'
              className='text-muted-foreground w-fit'
              onClick={() => setDialogOpen(true)}>
              <PlusIcon />
              {loc.no.tournament.new}
            </Button>
          )}
          {!canCreate && loc.no.tournament.noTournaments}
        </Empty>
      )}

      {sessionTournaments.map(tournament => (
        <TournamentCard key={tournament.id} tournament={tournament} />
      ))}
    </div>
  )
}
