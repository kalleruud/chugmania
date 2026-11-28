import { useConnection } from '@/contexts/ConnectionContext'
import loc from '@common/locale/locales'
import { MAX_TRACK_NICKNAME_LENGTH, type Track } from '@common/models/track'
import { PencilIcon } from '@heroicons/react/24/solid'
import { useId, useState, type SubmitEvent } from 'react'
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

export default function TrackNicknameDialog({
  track,
}: Readonly<{ track: Track }>) {
  const { socket, isConnected } = useConnection()
  const inputId = useId()
  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState(track.nickname ?? '')
  const [pending, setPending] = useState(false)
  const trimmed = nickname.trim()
  const title = track.nickname
    ? loc.no.tracks.nickname.edit
    : loc.no.tracks.nickname.add

  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    try {
      const response = await socket.emitWithAck('edit_track', {
        type: 'EditTrackRequest',
        id: track.id,
        nickname: trimmed || null,
      })
      if (!response.success) throw new Error(response.message)
      toast.success(
        response.track.nickname
          ? loc.no.tracks.nickname.saved
          : loc.no.tracks.nickname.removed
      )
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
        if (pending) return
        if (value) setNickname(track.nickname ?? '')
        setOpen(value)
      }}>
      <DialogTrigger asChild>
        <Button
          variant='ghost'
          size='sm'
          className='w-fit text-muted-foreground'
          disabled={!isConnected}>
          <PencilIcon />
          {title}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {loc.no.tracks.nickname.description}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className='flex flex-col gap-4'>
          <Label className='sr-only' htmlFor={inputId}>
            {loc.no.tracks.nickname.title}
          </Label>
          <Input
            id={inputId}
            value={nickname}
            autoFocus
            placeholder={'#' + track.name}
            maxLength={MAX_TRACK_NICKNAME_LENGTH}
            disabled={pending}
            onChange={event => setNickname(event.target.value)}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button type='button' variant='outline' disabled={pending}>
                {loc.no.common.cancel}
              </Button>
            </DialogClose>
            <Button
              type='submit'
              disabled={pending || trimmed === (track.nickname ?? '')}>
              {loc.no.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
