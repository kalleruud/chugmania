import LapTimeInput from '@/components/timeentries/LapTimeInput'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
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
  close: () => void
}

const TimeEntryInputContext = createContext<
  TimeEntryInputContextType | undefined
>(undefined)

export default function TimeEntryInputProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [state, setState] =
    useState<TimeEntryInputContextType['state']>('closed')
  const [editingTimeEntry, setEditingTimeEntry] = useState<Partial<TimeEntry>>(
    {}
  )
  const { loggedInUser, isLoggedIn } = useAuth()
  const { socket } = useConnection()

  const localeStrings = editingTimeEntry.id
    ? loc.no.timeEntry.input.edit
    : loc.no.timeEntry.input.create

  const isEditing = !!editingTimeEntry?.id

  const isEditingSelf =
    isLoggedIn && isEditing && loggedInUser.id === editingTimeEntry.user
  const canEdit =
    isEditingSelf || !isEditing || (isLoggedIn && loggedInUser.role !== 'user')

  function open(
    editingTimeEntry: Parameters<TimeEntryInputContextType['open']>[0] = {}
  ) {
    setEditingTimeEntry(editingTimeEntry)
    setState('open')
  }

  function close() {
    setState('closed')
  }

  function handleDelete() {
    if (!editingTimeEntry?.id) {
      return toast.error('Not editing...')
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
      loc.no.timeEntry.input.deleteRequest
    )
  }

  const context = useMemo<TimeEntryInputContextType>(
    () => ({
      state,
      open,
      close,
    }),
    [state]
  )

  return (
    <TimeEntryInputContext.Provider value={context}>
      <Dialog
        open={state === 'open'}
        onOpenChange={open => setState(open ? 'open' : 'closed')}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{localeStrings.title}</DialogTitle>
            <DialogDescription>{localeStrings.description}</DialogDescription>
          </DialogHeader>

          <LapTimeInput
            id='laptimeInput'
            editingTimeEntry={editingTimeEntry}
            disabled={!canEdit}
          />

          <DialogFooter>
            <DialogClose asChild>
              <Button variant='outline'>{loc.no.dialog.cancel}</Button>
            </DialogClose>
            {canEdit && isEditing && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type='button' variant='destructive'>
                    <Trash2 />
                    {loc.no.dialog.delete}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {loc.no.dialog.confirmDelete.title}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {loc.no.dialog.confirmDelete.description}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>
                      {loc.no.dialog.cancel}
                    </AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>
                      {loc.no.dialog.continue}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {canEdit && (
              <Button
                type='submit'
                form='laptimeInput'
                className='flex gap-1'
                onClick={close}>
                {isEditing
                  ? loc.no.timeEntry.input.update
                  : loc.no.timeEntry.input.submit}
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
