import LapTimeInput from '@/app/components/LapTimeInput'
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
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { useAuth } from '@/contexts/AuthContext'
import loc from '@/lib/locales'
import { Trash2 } from 'lucide-react'
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { TimeEntry } from '../../common/models/timeEntry'

type TimeEntryDialogContextType = {
  state: 'open' | 'closed'
  open: (editingTimeEntry?: Partial<TimeEntry>) => void
  close: () => void
}

const TimeEntryDialogContext = createContext<
  TimeEntryDialogContextType | undefined
>(undefined)

export default function TimeEntryDialogProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [state, setState] =
    useState<TimeEntryDialogContextType['state']>('closed')
  const [editingTimeEntry, setEditingTimeEntry] = useState<Partial<TimeEntry>>(
    {}
  )
  const { user: loggedInUser, isLoggedIn } = useAuth()

  const localeStrings = editingTimeEntry.id
    ? loc.no.timeEntry.input.edit
    : loc.no.timeEntry.input.create

  const isEditing = !!editingTimeEntry?.id

  const isEditingSelf =
    isLoggedIn && isEditing && loggedInUser?.id === editingTimeEntry.user
  const canEdit = isEditingSelf || (isLoggedIn && loggedInUser?.role !== 'user')

  function open(
    editingTimeEntry: Parameters<TimeEntryDialogContextType['open']>[0] = {}
  ) {
    setEditingTimeEntry(editingTimeEntry)
    setState('open')
  }

  function close() {
    setState('closed')
  }

  const context = useMemo<TimeEntryDialogContextType>(
    () => ({
      state,
      open,
      close,
    }),
    [state]
  )

  return (
    <TimeEntryDialogContext.Provider value={context}>
      <Drawer
        open={state === 'open'}
        onOpenChange={open => setState(open ? 'open' : 'closed')}>
        <DrawerContent>
          <DrawerHeader className='text-left'>
            <DrawerTitle>{localeStrings.title}</DrawerTitle>
            <DrawerDescription>{localeStrings.description}</DrawerDescription>
          </DrawerHeader>

          <LapTimeInput
            id='laptimeInput'
            className='px-4'
            editingTimeEntry={editingTimeEntry}
            onSubmitSuccessful={close}
            disabled={!canEdit}
          />

          <DrawerFooter>
            <Button type='submit' form='laptimeInput'>
              {isEditing
                ? loc.no.timeEntry.input.update
                : loc.no.timeEntry.input.submit}
            </Button>
            {isEditing && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type='button'
                    variant='destructive'
                    className='w-full'>
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
                    <AlertDialogAction>
                      {loc.no.dialog.continue}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <DrawerClose asChild>
              <Button variant='outline' className='w-full'>
                {loc.no.dialog.cancel}
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
      {children}
    </TimeEntryDialogContext.Provider>
  )
}

export const useTimeEntryDrawer = () => {
  const context = useContext(TimeEntryDialogContext)
  if (!context) throw new Error('useData must be used inside DataProvider')
  return context
}
