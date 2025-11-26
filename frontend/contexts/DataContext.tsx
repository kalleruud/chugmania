import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Leaderboard } from '../../common/models/leaderboard'
import type { SessionWithSignups } from '../../common/models/session'
import type { Track } from '../../common/models/track'
import type { UserInfo } from '../../common/models/user'
import { useConnection } from './ConnectionContext'

type DataContextType = {
  tracks: Record<string, Track> | undefined
  leaderboards: Record<string, Leaderboard> | undefined
  users: Record<string, UserInfo> | undefined
  sessions: Record<string, SessionWithSignups> | undefined
}

const DataContext = createContext<DataContextType | undefined>(undefined)

function toIdRecord<T extends { id: string }>(entries: T[]): Record<string, T> {
  const map: Record<string, T> = {}
  for (const entry of entries) {
    map[entry.id] = entry
  }
  return map
}

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

export function DataProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { socket } = useConnection()

  const [tracks, setTracks] = useState<DataContextType['tracks']>(undefined)
  const [leaderboards, setLeaderboards] =
    useState<DataContextType['leaderboards']>(undefined)
  const [users, setUsers] = useState<DataContextType['users']>(undefined)
  const [sessions, setSessions] =
    useState<DataContextType['sessions']>(undefined)

  useEffect(() => {
    socket.on('all_tracks', (data: Track[]) => {
      setTracks(toIdRecord(parseDatesArray(data)))
    })

    socket.on('all_leaderboards', (data: Leaderboard[]) => {
      setLeaderboards(toIdRecord(parseDatesArray(data)))
    })

    socket.on('all_users', (data: UserInfo[]) => {
      setUsers(toIdRecord(parseDatesArray(data)))
    })

    socket.on('all_sessions', (data: SessionWithSignups[]) => {
      setSessions(toIdRecord(parseDatesArray(data)))
    })

    return () => {
      socket.off('all_leaderboards')
      socket.off('all_sessions')
      socket.off('all_tracks')
      socket.off('all_users')
    }
  }, [])

  const context = useMemo<DataContextType>(
    () => ({
      leaderboards,
      sessions,
      tracks,
      users,
    }),
    [tracks, leaderboards, users, sessions]
  )

  return <DataContext.Provider value={context}>{children}</DataContext.Provider>
}

export const useData = () => {
  const context = useContext(DataContext)
  if (!context) throw new Error('useData must be used inside DataProvider')
  return context
}
