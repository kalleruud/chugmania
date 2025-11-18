import loc from '@/lib/locales'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'
import {
  WS_BROADCAST_LEADERBOARDS,
  type Leaderboard,
  type LeaderboardBroadcast,
} from '../../common/models/leaderboard'
import {
  WS_BROADCAST_TRACKS,
  type Track,
  type TrackBroadcast,
} from '../../common/models/track'
import {
  WS_BROADCAST_USERS,
  type UserBroadcast,
  type UserInfo,
} from '../../common/models/user'
import { useConnection } from './ConnectionContext'

type DataContextType = {
  tracks: Record<string, Track> | undefined
  leaderboards: Record<string, Leaderboard> | undefined
  users: Record<string, UserInfo> | undefined
}

const DataContext = createContext<DataContextType | undefined>(undefined)

function toIdRecord<T extends { id: string }>(entries: T[]): Record<string, T> {
  const map: Record<string, T> = {}
  for (const entry of entries) {
    map[entry.id] = entry
  }
  return map
}

export function DataProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { socket } = useConnection()

  const [tracks, setTracks] = useState<DataContextType['tracks']>(undefined)
  const [leaderboards, setLeaderboards] =
    useState<DataContextType['leaderboards']>(undefined)
  const [users, setUsers] = useState<DataContextType['users']>(undefined)

  useEffect(() => {
    socket.on(WS_BROADCAST_TRACKS, (data: TrackBroadcast) => {
      if (!tracks) toast.info(loc.no.tracks.receivedUpdate)
      setTracks(toIdRecord(data))
    })

    socket.on(WS_BROADCAST_LEADERBOARDS, (data: LeaderboardBroadcast) => {
      if (!leaderboards) toast.info(loc.no.timeEntry.receivedUpdate)
      setLeaderboards(toIdRecord(data))
    })

    socket.on(WS_BROADCAST_USERS, (data: UserBroadcast) => {
      if (!users) toast.info(loc.no.users.receivedUpdate)
      setUsers(toIdRecord(data))
    })

    return () => {
      socket.off(WS_BROADCAST_TRACKS)
      socket.off(WS_BROADCAST_LEADERBOARDS)
      socket.off(WS_BROADCAST_USERS)
    }
  }, [])

  const context = useMemo<DataContextType>(
    () => ({
      tracks,
      leaderboards,
      users,
    }),
    [tracks, leaderboards, users]
  )

  return <DataContext.Provider value={context}>{children}</DataContext.Provider>
}

export const useData = () => {
  const context = useContext(DataContext)
  if (!context) throw new Error('useData must be used inside DataProvider')
  return context
}
