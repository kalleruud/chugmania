import { use } from 'react'
import { DataContext } from './data-context'

export const useData = () => {
  const context = use(DataContext)
  if (!context) throw new Error('useData must be used inside DataProvider')
  return context
}
