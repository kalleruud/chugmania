import { useConnection } from '@/contexts/ConnectionContext'
import loc from '@common/locale/locales'
import { getTrackName } from '@common/models/track'
import { PlusIcon } from '@heroicons/react/24/solid'
import { useId, useState, type SubmitEvent } from 'react'
import { useNavigate } from 'react-router'
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
import { Input } from '../ui/input'
import { Label } from '../ui/label'

export default function ImportTrackDialog() {
  const { socket, isConnected } = useConnection()
  const navigate = useNavigate()
  const inputId = useId()
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [pending, setPending] = useState(false)

  async function importTrack(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    try {
      const response = await socket.emitWithAck('import_track', {
        type: 'ImportTrackRequest',
        url: url.trim(),
      })
      if (!response.success) throw new Error(response.message)
      toast.success(loc.no.tracks.import.added(getTrackName(response.track)))
      setOpen(false)
      void navigate(`/tracks/${response.track.id}`)
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
        if (pending) return
        if (value) setUrl('')
        setOpen(value)
      }}>
      <DialogTrigger asChild>
        <Button
          variant='ghost'
          size='sm'
          className='mt-2 w-fit text-muted-foreground'
          disabled={!isConnected}>
          <PlusIcon />
          {loc.no.tracks.import.title}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{loc.no.tracks.import.title}</DialogTitle>
          <DialogDescription>
            {loc.no.tracks.import.description}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={importTrack} className='flex flex-col gap-4'>
          <Label className='sr-only' htmlFor={inputId}>
            {loc.no.tracks.import.link}
          </Label>
          <Input
            id={inputId}
            type='url'
            inputMode='url'
            value={url}
            required
            autoFocus
            placeholder='https://trackmania.exchange/mapshow/…'
            disabled={pending}
            onChange={event => setUrl(event.target.value)}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button type='button' variant='outline' disabled={pending}>
                {loc.no.common.cancel}
              </Button>
            </DialogClose>
            <Button type='submit' disabled={pending || !url.trim()}>
              {loc.no.tracks.import.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
