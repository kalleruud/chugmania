import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import loc from '@common/locale/locales'
import type { SessionWithSignups } from '@common/models/session'
import { PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { Empty } from '../ui/empty'
import TournamentForm from './TournamentForm'
import TournamentPanel from './TournamentPanel'

export default function TournamentTab({
  session,
}: {
  session: SessionWithSignups
}) {
  const { isLoggedIn, loggedInUser } = useAuth()
  const { socket, isConnected } = useConnection()
  const { tournaments, applyTournamentDetails } = useData()
  const [creating, setCreating] = useState(false)
  const details = tournaments?.find(
    tournament => tournament.config.session === session.id
  )
  const canEdit = isLoggedIn && loggedInUser.role !== 'user'

  async function create() {
    if (creating || !isConnected || session.status === 'cancelled') return
    setCreating(true)
    try {
      const response = await socket.emitWithAck('create_tournament', {
        session: session.id,
      })
      if (!response.success) throw new Error(response.message)
      applyTournamentDetails(response.details, session.id)
      toast.success(loc.no.tournament.saved)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setCreating(false)
    }
  }

  if (!details)
    return (
      <Empty className='border border-input text-sm text-muted-foreground'>
        {canEdit ? (
          <Button
            variant='outline'
            size='sm'
            disabled={
              creating || !isConnected || session.status === 'cancelled'
            }
            onClick={() => void create()}>
            <PlusIcon />
            {loc.no.tournament.create}
          </Button>
        ) : (
          loc.no.common.noItems
        )}
      </Empty>
    )
  if (details.status === 'started') return <TournamentPanel details={details} />
  return (
    <div className='flex min-w-0 flex-col gap-6'>
      {details.canConfigure && (
        <TournamentForm key={details.id} details={details} />
      )}
      <TournamentPanel details={details} />
    </div>
  )
}
