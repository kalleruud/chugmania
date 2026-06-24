import { useContext } from 'react'
import { TimeEntryInputContext } from './time-entry-input-context'

export const useTimeEntryInput = () => {
  const context = useContext(TimeEntryInputContext)
  if (!context)
    throw new Error(
      'useTimeEntryInput must be used inside TimeEntryInputProvider'
    )
  return context
}
