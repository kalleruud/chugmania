import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import { useTimeEntryInput } from '@/contexts/TimeEntryInputContext'
import loc from '@common/locale/locales'
import type { TournamentDetails } from '@common/models/tournament'
import { toast } from 'sonner'
import TimeEntryRow from '../timeentries/TimeEntryRow'
import { Button } from '../ui/button'

export default function TournamentTieBreakerPanel({
  details,
}: {
  details: TournamentDetails
}) {
  const { loggedInUser } = useAuth()
  const { socket } = useConnection()
  const { open } = useTimeEntryInput()
  const canCancel =
    !!loggedInUser && loggedInUser.role !== 'user' && !details.cancelled
  if (!details.tieBreakers.length) return null
  return (
    <section className='flex flex-col gap-2 rounded-sm border bg-background p-4'>
      <h3>{loc.no.tournament.tieBreakers}</h3>
      {details.tieBreakers.map(lap => (
        <div key={lap.id} className='flex flex-wrap items-center gap-2'>
          <TimeEntryRow
            item={lap}
            className='min-w-40 flex-1 p-2'
            onClick={() => open(lap)}
            role='button'
            tabIndex={0}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                open(lap)
              }
            }}
            onChangeGapType={() => {}}
          />
          <span
            className={
              lap.required
                ? 'text-sm text-primary'
                : 'text-sm text-muted-foreground'
            }>
            {lap.required
              ? loc.no.tournament.requiredTieBreaker
              : loc.no.tournament.optionalTieBreaker}
          </span>
          {canCancel && lap.status === 'planned' && (
            <Button
              size='sm'
              variant='outline'
              onClick={() => {
                toast.promise(
                  socket
                    .emitWithAck('edit_time_entry', {
                      type: 'EditTimeEntryRequest',
                      id: lap.id,
                      status: 'cancelled',
                    })
                    .then(response => {
                      if (!response.success) throw new Error(response.message)
                    }),
                  {
                    success: loc.no.tournament.tieBreakerCancelled,
                    error: (error: Error) => error.message,
                  }
                )
              }}>
              {loc.no.tournament.cancelTieBreaker}
            </Button>
          )}
        </div>
      ))}
    </section>
  )
}
