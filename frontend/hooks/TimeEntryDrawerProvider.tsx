import LapTimeInput from '@/app/components/LapTimeInput'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { useAuth } from '@/contexts/AuthContext'
import loc from '@/lib/locales'
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

  const isEditingSelf = isLoggedIn && loggedInUser?.id === editingTimeEntry.user
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
          {canEdit && (
            <DrawerHeader className='text-left'>
              <DrawerTitle>{localeStrings.title}</DrawerTitle>
              <DrawerDescription>{localeStrings.description}</DrawerDescription>
            </DrawerHeader>
          )}

          <LapTimeInput
            className='pb-safe-offset-8 p-4'
            editingTimeEntry={editingTimeEntry}
            onSubmitSuccessful={close}
            disabled={!canEdit}
          />
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
