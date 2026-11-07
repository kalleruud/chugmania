import loc from '@common/locale/locales'
import type { Match } from '@common/models/match'
import type { Ranking } from '@common/models/ranking'
import type { ResultDrafts } from '@common/models/resultDraft'
import type { SessionWithSignups } from '@common/models/session'
import type { TimeEntry } from '@common/models/timeEntry'
import type { TournamentDetails } from '@common/models/tournament'
import type { Track } from '@common/models/track'
import type { UserInfo } from '@common/models/user'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'
import { useConnection } from './ConnectionContext'

type DataContextType = {
  resultDrafts: ResultDrafts
  applyTournamentDetails: (
    details: TournamentDetails | null,
    session: string
  ) => void
} & (
  | {
      isLoadingData: false
      tracks: Track[]
      timeEntries: TimeEntry[]
      users: UserInfo[]
      sessions: SessionWithSignups[]
      matches: Match[]
      rankings: Ranking[]
      tournaments: TournamentDetails[]
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
)

const DataContext = createContext<DataContextType | undefined>(undefined)

/**
 * Automatically converts timestamp fields to Date objects.
 * Handles: createdAt, updatedAt, deletedAt, date
 */
function parseDates<T extends Record<string, unknown>>(obj: T): T {
  const dateFields = ['createdAt', 'updatedAt', 'deletedAt', 'date']
  const result: Record<string, unknown> = { ...obj }

  for (const field of dateFields) {
    if (typeof result[field] === 'number') {
      result[field] = new Date(result[field])
    }
  }

  return result as T
}

/**
 * Applies date parsing to an array of objects
 */
function parseDatesArray<T extends Record<string, unknown>>(arr: T[]): T[] {
  return arr.map(parseDates)
}

function parseTournament(details: TournamentDetails): TournamentDetails {
  return {
    ...details,
    matches: parseDatesArray(details.matches),
    tieBreakers: parseDatesArray(details.tieBreakers),
  }
}

export function DataProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { socket } = useConnection()
  const [resultDrafts, setResultDrafts] = useState<ResultDrafts>({
    timeEntries: [],
    matches: [],
  })

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

  const applyTournamentDetails = useCallback(
    (details: TournamentDetails | null, session: string) => {
      setTournaments(previous => {
        if (!previous) return previous
        const remaining = previous.filter(
          tournament => tournament.config.session !== session
        )
        return details ? [...remaining, parseTournament(details)] : remaining
      })
    },
    []
  )

  useEffect(() => {
    let previousDrafts: string | undefined
    const applyDrafts = (data: ResultDrafts, actor: string | null = null) => {
      const serialized = JSON.stringify(data)
      if (
        previousDrafts !== undefined &&
        previousDrafts !== serialized &&
        actor !== socket.id
      )
        toast.info(loc.no.session.resultsChanged)
      previousDrafts = serialized
      setResultDrafts({
        timeEntries: parseDatesArray(data.timeEntries),
        matches: parseDatesArray(data.matches),
      })
    }
    const clearDrafts = () => {
      previousDrafts = undefined
      setResultDrafts({ timeEntries: [], matches: [] })
    }
    socket.on('all_result_drafts', applyDrafts)
    socket.on('disconnect', clearDrafts)
    let previousTournaments: string | undefined
    socket.on('all_tournaments', (data, actor) => {
      const serialized = JSON.stringify(data)
      if (
        previousTournaments !== undefined &&
        previousTournaments !== serialized &&
        actor !== socket.id
      )
        toast.info(loc.no.tournament.changed)
      previousTournaments = serialized
      setTournaments(data.map(parseTournament))
    })
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

    return () => {
      socket.off('all_result_drafts', applyDrafts)
      socket.off('disconnect', clearDrafts)
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
      return { isLoadingData: true, applyTournamentDetails, resultDrafts }
    }
    return {
      isLoadingData: false,
      resultDrafts,
      applyTournamentDetails,
      timeEntries,
      sessions,
      tracks,
      users,
      matches,
      rankings,
      tournaments,
    }
  }, [
    tracks,
    timeEntries,
    users,
    sessions,
    matches,
    rankings,
    tournaments,
    applyTournamentDetails,
    resultDrafts,
  ])

  return <DataContext.Provider value={context}>{children}</DataContext.Provider>
}

export const useData = () => {
  const context = useContext(DataContext)
  if (!context) throw new Error('useData must be used inside DataProvider')
  return context
}
