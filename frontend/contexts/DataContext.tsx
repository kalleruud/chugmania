import type { Match } from '@common/models/match'
import type { Ranking } from '@common/models/ranking'
import type { SessionWithSignups } from '@common/models/session'
import type { TimeEntry } from '@common/models/timeEntry'
import type { TournamentWithStructure } from '@common/models/tournament'
import type { Track } from '@common/models/track'
import type { UserInfo } from '@common/models/user'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useConnection } from './ConnectionContext'

type DataContextType =
  | {
      isLoadingData: false
      tracks: Track[]
      timeEntries: TimeEntry[]
      users: UserInfo[]
      sessions: SessionWithSignups[]
      matches: Match[]
      rankings: Ranking[]
      tournaments: TournamentWithStructure[]
    }
  | {
      isLoadingData: true
      tracks?: never
      timeEntries?: never
      users?: never
      sessions?: never
      matches?: never
      rankings?: never
      tournaments?: never
    }

const DataContext = createContext<DataContextType | undefined>(undefined)

/**
 * Automatically converts timestamp fields to Date objects.
 * Handles: createdAt, updatedAt, deletedAt, date
 */
export function parseDates<T extends Record<string, any>>(obj: T): T {
  const dateFields = [
    'createdAt',
    'updatedAt',
    'deletedAt',
    'date',
    'completedAt',
  ]
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

function parseTournamentData(data: TournamentWithStructure[]) {
  return data.map(t => ({
    ...parseDates(t),
    groups: t.groups.map(g => ({
      ...parseDates(g),
      players: g.players.map(p => ({
        ...parseDates(p),
        user: parseDates(p.user),
      })),
    })),
    tournamentMatches: t.tournamentMatches.map(parseDates),
  }))
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
  const [timeEntries, setTimeEntries] =
    useState<DataContextType['timeEntries']>(undefined)
  const [users, setUsers] = useState<DataContextType['users']>(undefined)
  const [sessions, setSessions] =
    useState<DataContextType['sessions']>(undefined)
  const [matches, setMatches] = useState<DataContextType['matches']>(undefined)
  const [rankings, setRankings] =
    useState<DataContextType['rankings']>(undefined)
  const [tournaments, setTournaments] =
    useState<DataContextType['tournaments']>(undefined)

  useEffect(() => {
    socket.on('all_sessions', data => {
      setSessions(parseDatesArray(data))
    })

    socket.on('all_time_entries', data => {
      setTimeEntries(parseDatesArray(data))
    })

    socket.on('all_tracks', data => {
      setTracks(parseDatesArray(data))
    })

    socket.on('all_users', data => {
      setUsers(parseDatesArray(data))
    })

    socket.on('all_matches', data => {
      setMatches(parseDatesArray(data))
    })

    socket.on('all_rankings', data => {
      setRankings(data)
    })

    socket.on('all_tournaments', data => {
      setTournaments(parseTournamentData(data))
    })

    return () => {
      socket.off('all_sessions')
      socket.off('all_time_entries')
      socket.off('all_tracks')
      socket.off('all_users')
      socket.off('all_matches')
      socket.off('all_rankings')
      socket.off('all_tournaments')
    }
  }, [])

  const context = useMemo<DataContextType>(() => {
    if (
      tracks === undefined ||
      timeEntries === undefined ||
      users === undefined ||
      sessions === undefined ||
      matches === undefined ||
      rankings === undefined ||
      tournaments === undefined
    ) {
      return { isLoadingData: true }
    }
    return {
      isLoadingData: false,
      timeEntries,
      sessions,
      tracks,
      users,
      matches,
      rankings,
      tournaments,
    }
  }, [tracks, timeEntries, users, sessions, matches, rankings, tournaments])

  return <DataContext.Provider value={context}>{children}</DataContext.Provider>
}

export const useData = () => {
  const context = useContext(DataContext)
  if (!context) throw new Error('useData must be used inside DataProvider')
  return context
}
