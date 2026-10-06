import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import loc from '@common/locale/locales'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog'

export default function DeleteTournamentDialog({
  session,
  isDraft = false,
  disabled = false,
}: {
  session: string
  isDraft?: boolean
  disabled?: boolean
}) {
  const { socket, isConnected } = useConnection()
  const { applyTournamentDetails } = useData()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function deleteTournament(deleteRelatedResults: boolean) {
    setPending(true)
    try {
      const response = await socket.emitWithAck('delete_tournament', {
        session,
        deleteRelatedResults,
      })
      if (!response.success) throw new Error(response.message)
      applyTournamentDetails(null, session)
      toast.success(loc.no.tournament.deleted)
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={value => {
        if (!pending) setOpen(value)
      }}>
      <DialogTrigger asChild>
        <Button
          type='button'
          variant='destructive'
          disabled={disabled || !isConnected}>
          {loc.no.common.delete}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{loc.no.tournament.deleteTitle}</DialogTitle>
          <DialogDescription>
            {isDraft
              ? loc.no.tournament.draftDeleteDescription
              : loc.no.tournament.deleteDescription}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className='sm:flex-col'>
          {!isDraft && (
            <Button
              type='button'
              disabled={pending || !isConnected}
              variant='outline'
              onClick={() => deleteTournament(false)}>
              {loc.no.tournament.keepResults}
            </Button>
          )}
          <Button
            type='button'
            disabled={pending || !isConnected}
            variant='destructive'
            onClick={() => deleteTournament(true)}>
            {isDraft ? loc.no.common.delete : loc.no.tournament.deleteResults}
          </Button>
          <DialogClose asChild>
            <Button type='button' disabled={pending} variant='ghost'>
              {loc.no.common.cancel}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
