import { useConnection } from '@/contexts/ConnectionContext'
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
}: {
  session: string
}) {
  const { socket } = useConnection()
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
        <Button variant='destructive'>{loc.no.common.delete}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{loc.no.tournament.deleteTitle}</DialogTitle>
          <DialogDescription>
            {loc.no.tournament.deleteDescription}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className='sm:flex-col'>
          <Button
            disabled={pending}
            variant='outline'
            onClick={() => deleteTournament(false)}>
            {loc.no.tournament.keepResults}
          </Button>
          <Button
            disabled={pending}
            variant='destructive'
            onClick={() => deleteTournament(true)}>
            {loc.no.tournament.deleteResults}
          </Button>
          <DialogClose asChild>
            <Button disabled={pending} variant='ghost'>
              {loc.no.common.cancel}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
