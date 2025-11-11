import LapTimeInput from '@/app/components/LapTimeInput'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
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
            <DrawerTitle>{loc.no.timeEntryInput.title}</DrawerTitle>
            <DrawerDescription>
              {loc.no.timeEntryInput.description}
            </DrawerDescription>
          </DrawerHeader>

          <LapTimeInput
            className='p-4'
            editingTimeEntry={editingTimeEntry}
            onSubmitSuccessful={close}
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
