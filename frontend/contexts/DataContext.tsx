import type { SessionWithSignups } from '@common/models/session'
import type {
  DataAction,
  Resource,
  ResourceUpdate,
} from '@common/models/socket.io'
import type { TimeEntry } from '@common/models/timeEntry'
import type { Track } from '@common/models/track'
import type { UserInfo } from '@common/models/user'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useConnection } from './ConnectionContext'

type DataContextType = {
  isLoadingData: boolean
  tracks: Track[]
  timeEntries: TimeEntry[]
  users: UserInfo[]
  sessions: SessionWithSignups[]
  subscribe: (resources: Resource[]) => void
  unsubscribe: (resources: Resource[]) => void
}

const DataContext = createContext<DataContextType | undefined>(undefined)

/**
 * Automatically converts timestamp fields to Date objects.
 * Handles: createdAt, updatedAt, deletedAt, date
 */
export function parseDates<T extends Record<string, any>>(obj: T): T {
  const dateFields = ['createdAt', 'updatedAt', 'deletedAt', 'date']
  const result: any = { ...obj }

  for (const field of dateFields) {
    if (
      field in result &&
      result[field] !== null &&
      result[field] !== undefined
    ) {
      result[field] = new Date(result[field])
    }
  }

  return result
}

/**
 * Applies date parsing to an array of objects
 */
export function parseDatesArray<T extends Record<string, any>>(arr: T[]): T[] {
  return arr.map(parseDates)
}

function handleUpdate<T extends { id: string }>(
  prev: T[],
  action: DataAction,
  id: string,
  data?: any
): T[] {
  if (action === 'create') return [...prev, parseDates(data)]
  if (action === 'update')
    return prev.map(item => (item.id === id ? parseDates(data) : item))
  if (action === 'delete') return prev.filter(item => item.id !== id)
  return prev
}

export function DataProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { socket } = useConnection()

  const [tracks, setTracks] = useState<Track[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [users, setUsers] = useState<UserInfo[]>([])
  const [sessions, setSessions] = useState<SessionWithSignups[]>([])

  const subCounts = useRef<Record<Resource, number>>({
    sessions: 0,
    time_entries: 0,
    tracks: 0,
    users: 0,
  })

  const subscribe = useCallback(
    (resources: Resource[]) => {
      const toSubscribe: Resource[] = []
      resources.forEach(r => {
        subCounts.current[r]++
        if (subCounts.current[r] === 1) {
          toSubscribe.push(r)
        }
      })
      if (toSubscribe.length > 0) {
        socket.emit('subscribe', toSubscribe)
      }
    },
    [socket]
  )

  const unsubscribe = useCallback(
    (resources: Resource[]) => {
      const toUnsubscribe: Resource[] = []
      resources.forEach(r => {
        subCounts.current[r]--
        if (subCounts.current[r] <= 0) {
          subCounts.current[r] = 0 // Safety
          toUnsubscribe.push(r)
          // Clear data
          if (r === 'sessions') setSessions([])
          if (r === 'tracks') setTracks([])
          if (r === 'time_entries') setTimeEntries([])
          if (r === 'users') setUsers([])
        }
      })
      if (toUnsubscribe.length > 0) {
        socket.emit('unsubscribe', toUnsubscribe)
      }
    },
    [socket]
  )

  useEffect(() => {
    socket.on('resource_initial_data', (resource, data) => {
      const parsed = parseDatesArray(data)
      if (resource === 'sessions') setSessions(parsed)
      if (resource === 'tracks') setTracks(parsed)
      if (resource === 'time_entries') setTimeEntries(parsed)
      if (resource === 'users') setUsers(parsed)
    })

    socket.on('resource_updated', (update: ResourceUpdate) => {
      const { resource, action, id, data } = update
      if (resource === 'sessions')
        setSessions(prev => handleUpdate(prev, action, id, data))
      if (resource === 'tracks')
        setTracks(prev => handleUpdate(prev, action, id, data))
      if (resource === 'time_entries')
        setTimeEntries(prev => handleUpdate(prev, action, id, data))
      if (resource === 'users')
        setUsers(prev => handleUpdate(prev, action, id, data))
    })

    return () => {
      socket.off('resource_initial_data')
      socket.off('resource_updated')
    }
  }, [socket])

  const context = useMemo<DataContextType>(() => {
    return {
      isLoadingData: false,
      timeEntries,
      sessions,
      tracks,
      users,
      subscribe,
      unsubscribe,
    }
  }, [tracks, timeEntries, users, sessions, subscribe, unsubscribe])

  return <DataContext.Provider value={context}>{children}</DataContext.Provider>
}

export const useData = () => {
  const context = useContext(DataContext)
  if (!context) throw new Error('useData must be used inside DataProvider')
  return context
}

export const useDataSubscription = (resources: Resource[]) => {
  const { subscribe, unsubscribe } = useData()
  useEffect(() => {
    subscribe(resources)
    return () => unsubscribe(resources)
  }, [JSON.stringify(resources), subscribe, unsubscribe])
}
