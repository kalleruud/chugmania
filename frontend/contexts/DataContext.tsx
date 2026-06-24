import { useEffect, useReducer, type ReactNode } from 'react'
import { DataContext, type DataContextType } from './data-context'
import { useConnection } from './useConnection'

type DateField = 'createdAt' | 'updatedAt' | 'deletedAt' | 'date'
type ObjectWithDates = Partial<
  Record<DateField, string | number | Date | null | undefined>
>
type LoadedDataContext = Extract<DataContextType, { isLoadingData: false }>
type DataState = Partial<Omit<LoadedDataContext, 'isLoadingData'>>
type DataAction = NonNullable<
  {
    [K in keyof DataState]: { key: K; value: DataState[K] }
  }[keyof DataState]
>

function parseDates<T extends ObjectWithDates>(obj: T): T {
  const dateFields: DateField[] = [
    'createdAt',
    'updatedAt',
    'deletedAt',
    'date',
  ]
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
  const [data, dispatch] = useReducer(
    (state: DataState, action: DataAction) => ({
      ...state,
      [action.key]: action.value,
    }),
    {}
  )

  useEffect(() => {
    socket.on('all_sessions', data => {
      dispatch({ key: 'sessions', value: parseDatesArray(data) })
    })

    socket.on('all_time_entries', data => {
      dispatch({ key: 'timeEntries', value: parseDatesArray(data) })
    })

    socket.on('all_tracks', data => {
      dispatch({ key: 'tracks', value: parseDatesArray(data) })
    })

    socket.on('all_users', data => {
      dispatch({ key: 'users', value: parseDatesArray(data) })
    })

    socket.on('all_matches', data => {
      dispatch({ key: 'matches', value: parseDatesArray(data) })
    })

    socket.on('all_rankings', data => {
      dispatch({ key: 'rankings', value: data })
    })

    socket.on('all_tournaments', data => {
      dispatch({ key: 'tournaments', value: parseDatesArray(data) })
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
  }, [socket])

  const context: DataContextType =
    data.tracks === undefined ||
    data.timeEntries === undefined ||
    data.users === undefined ||
    data.sessions === undefined ||
    data.matches === undefined ||
    data.rankings === undefined ||
    data.tournaments === undefined
      ? { isLoadingData: true }
      : {
          isLoadingData: false,
          timeEntries: data.timeEntries,
          sessions: data.sessions,
          tracks: data.tracks,
          users: data.users,
          matches: data.matches,
          rankings: data.rankings,
          tournaments: data.tournaments,
        }

  return <DataContext.Provider value={context}>{children}</DataContext.Provider>
}
