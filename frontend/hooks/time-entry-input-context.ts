import type { Match } from '@common/models/match'
import type { TimeEntry } from '@common/models/timeEntry'
import { createContext } from 'react'

export type TimeEntryInputContextType = {
  state: 'open' | 'closed'
  open: (editingTimeEntry?: Partial<TimeEntry>) => void
  openMatch: (editingMatch?: Partial<Match>) => void
  close: () => void
}

export const TimeEntryInputContext = createContext<
  TimeEntryInputContextType | undefined
>(undefined)
