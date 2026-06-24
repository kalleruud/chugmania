import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { DataContext, type DataContextType } from './data-context'
import { useConnection } from './useConnection'

type DateField = 'createdAt' | 'updatedAt' | 'deletedAt' | 'date'
type ObjectWithDates = Partial<
  Record<DateField, string | number | Date | null | undefined>
>

function parseDates<T extends ObjectWithDates>(obj: T): T {
  const dateFields: DateField[] = ['createdAt', 'updatedAt', 'deletedAt', 'date']
  const result = { ...obj }

  for (const field of dateFields) {
    const value = result[field]
    if (value !== null && value !== undefined) result[field] = new Date(value)
  }

  return result
}

function parseDatesArray<T extends ObjectWithDates>(arr: T[]): T[] {
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
      setTournaments(parseDatesArray(data))
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
