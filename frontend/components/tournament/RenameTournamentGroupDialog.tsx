import { useConnection } from '@/contexts/ConnectionContext'
import loc from '@common/locale/locales'
import {
  MAX_TOURNAMENT_GROUP_NAME_LENGTH,
  type TournamentGroup,
} from '@common/models/tournament'
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

export default function RenameTournamentGroupDialog({
  session,
  group,
}: Readonly<{ session: string; group: TournamentGroup }>) {
  const { socket } = useConnection()
  const inputId = useId()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(group.name)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function rename(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const trimmed = name.trim()
    if (!trimmed || trimmed.length > MAX_TOURNAMENT_GROUP_NAME_LENGTH) {
      setError(loc.no.tournament.invalidGroupName)
      return
    }
    setPending(true)
    setError(null)
    try {
      const response = await socket.emitWithAck('rename_tournament_group', {
        session,
        groupId: group.id,
        name: trimmed,
      })
      if (!response.success) throw new Error(response.message)
      toast.success(loc.no.tournament.groupRenamed)
      setOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setError(message)
      toast.error(message)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={value => {
        if (pending) return
        if (value) {
          setName(group.name)
          setError(null)
        }
        setOpen(value)
      }}>
      <DialogTrigger asChild>
        <Button variant='outline' size='sm'>
          {loc.no.tournament.renameGroup}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{loc.no.tournament.renameGroup}</DialogTitle>
          <DialogDescription>
            {loc.no.tournament.renameGroupDescription}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={rename} className='flex flex-col gap-4'>
          <Label className='sr-only' htmlFor={inputId}>
            {loc.no.tournament.groupName}
          </Label>
          <Input
            id={inputId}
            value={name}
            required
            placeholder={loc.no.tournament.groupName}
            maxLength={MAX_TOURNAMENT_GROUP_NAME_LENGTH}
            disabled={pending}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : undefined}
            onChange={event => {
              setName(event.target.value)
              setError(null)
            }}
          />
          {error && (
            <p
              id={`${inputId}-error`}
              role='alert'
              className='text-destructive'>
              {error}
            </p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type='button' variant='ghost' disabled={pending}>
                {loc.no.common.cancel}
              </Button>
            </DialogClose>
            <Button
              type='submit'
              disabled={pending || name.trim() === group.name}>
              {loc.no.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
