import ConfirmationButton from '@/components/ConfirmationButton'
import MatchInput from '@/components/match/MatchInput'
import TimeEntryInput from '@/components/timeentries/TimeEntryInput'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import loc from '@/lib/locales'
import type { Match } from '@common/models/match'
import type { TimeEntry } from '@common/models/timeEntry'
import { Trash2 } from 'lucide-react'
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'

type TimeEntryInputContextType = {
  state: 'open' | 'closed'
  open: (editingTimeEntry?: Partial<TimeEntry>) => void
  openMatch: (editingMatch?: Partial<Match>) => void
  close: () => void
}

const TimeEntryInputContext = createContext<
  TimeEntryInputContextType | undefined
>(undefined)

export default function TimeEntryInputProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [mode, setMode] = useState<'closed' | 'timeEntry' | 'match'>('closed')
  const [editingTimeEntry, setEditingTimeEntry] = useState<Partial<TimeEntry>>(
    {}
  )
  const [editingMatch, setEditingMatch] = useState<Partial<Match>>({})
  const { loggedInUser, isLoggedIn } = useAuth()
  const { socket } = useConnection()

  const matchLocaleStrings = editingMatch.id
    ? {
        title: loc.no.match.edit,
        description: loc.no.match.description,
        deleteRequest: loc.no.match.toast.delete,
        update: loc.no.match.toast.update.success,
        submit: loc.no.match.new,
      }
    : {
        title: loc.no.match.new,
        description: loc.no.match.description,
        deleteRequest: loc.no.match.toast.delete,
        update: loc.no.match.toast.create.success,
        submit: loc.no.match.new,
      }

  const timeEntryLocaleStrings = editingTimeEntry.id
    ? {
        title: loc.no.timeEntry.input.edit.title,
        description: loc.no.timeEntry.input.edit.description,
        deleteRequest: loc.no.timeEntry.input.deleteRequest,
        update: loc.no.timeEntry.input.update,
        submit: loc.no.timeEntry.input.submit,
      }
    : {
        title: loc.no.timeEntry.input.create.title,
        description: loc.no.timeEntry.input.create.description,
        deleteRequest: loc.no.timeEntry.input.deleteRequest,
        update: loc.no.timeEntry.input.update,
        submit: loc.no.timeEntry.input.submit,
      }

  const localeStrings =
    mode === 'match' ? matchLocaleStrings : timeEntryLocaleStrings

  const isEditing = mode === 'match' ? !!editingMatch.id : !!editingTimeEntry.id

  const isEditingSelf =
    isLoggedIn && isEditing && mode === 'timeEntry'
      ? loggedInUser.id === editingTimeEntry.user
      : false

  const canEdit =
    mode === 'match'
      ? isLoggedIn && loggedInUser?.role !== 'user'
      : isEditingSelf ||
        !isEditing ||
        (isLoggedIn && loggedInUser?.role !== 'user')

  function open(
    editingTimeEntry: Parameters<TimeEntryInputContextType['open']>[0] = {}
  ) {
    setEditingTimeEntry(editingTimeEntry)
    setMode('timeEntry')
  }

  function openMatch(
    editingMatch: Parameters<TimeEntryInputContextType['openMatch']>[0] = {}
  ) {
    setEditingMatch(editingMatch)
    setMode('match')
  }

  function close() {
    setMode('closed')
  }

  function handleDelete() {
    if (mode === 'match') {
      if (!editingMatch?.id) return
      toast.promise(
        socket
          .emitWithAck('delete_match', {
            type: 'DeleteMatchRequest',
            id: editingMatch.id,
          })
          .then(r => {
            if (r.success) close()
            else throw new Error(r.message)
            return r
          }),
        localeStrings.deleteRequest
      )
      return
    }

    if (!editingTimeEntry?.id) {
      return toast.error('Du kan ikke slette en uregistrert tid...')
    }
    toast.promise(
      socket
        .emitWithAck('edit_time_entry', {
          type: 'EditTimeEntryRequest',
          id: editingTimeEntry?.id,
          deletedAt: new Date(),
        })
        .then(r => {
          if (r.success) close()
          else throw new Error(r.message)
          return r
        }),
      localeStrings.deleteRequest
    )
  }

  const context = useMemo<TimeEntryInputContextType>(
    () => ({
      state: mode === 'closed' ? 'closed' : 'open',
      open,
      openMatch,
      close,
    }),
    [mode]
  )

  return (
    <TimeEntryInputContext.Provider value={context}>
      <Dialog
        open={mode !== 'closed'}
        onOpenChange={open => setMode(open ? mode : 'closed')}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{localeStrings.title}</DialogTitle>
            <DialogDescription>{localeStrings.description}</DialogDescription>
          </DialogHeader>

          {mode === 'timeEntry' && (
            <TimeEntryInput
              id='inputForm'
              editingTimeEntry={editingTimeEntry}
              disabled={!canEdit}
              onSubmitResponse={success => success && close()}
            />
          )}

          {mode === 'match' && (
            <MatchInput
              id='inputForm'
              inputMatch={editingMatch}
              disabled={!canEdit}
              onSubmitResponse={success => success && close()}
            />
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant='outline'>{loc.no.common.cancel}</Button>
            </DialogClose>
            {canEdit && isEditing && (
              <ConfirmationButton
                type='button'
                variant='destructive'
                onClick={handleDelete}>
                <Trash2 />
                {loc.no.common.delete}
              </ConfirmationButton>
            )}

            {isEditing ? (
              <ConfirmationButton form='inputForm' disabled={!canEdit}>
                {mode === 'match' ? loc.no.match.edit : localeStrings.update}
              </ConfirmationButton>
            ) : (
              <Button form='inputForm' disabled={!canEdit}>
                {localeStrings.submit}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {children}
    </TimeEntryInputContext.Provider>
  )
}

export const useTimeEntryInput = () => {
  const context = useContext(TimeEntryInputContext)
  if (!context)
    throw new Error(
      'useTimeEntryInput must be used inside TimeEntryInputProvider'
    )
  return context
}
