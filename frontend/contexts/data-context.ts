import type { Match } from '@common/models/match'
import type { Ranking } from '@common/models/ranking'
import type { SessionWithSignups } from '@common/models/session'
import type { TimeEntry } from '@common/models/timeEntry'
import type { TournamentWithDetails } from '@common/models/tournament'
import type { Track } from '@common/models/track'
import type { UserInfo } from '@common/models/user'
import { createContext } from 'react'

export type DataContextType =
  | {
      isLoadingData: false
      tracks: Track[]
      timeEntries: TimeEntry[]
      users: UserInfo[]
      sessions: SessionWithSignups[]
      matches: Match[]
      rankings: Ranking[]
      tournaments: TournamentWithDetails[]
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

export const DataContext = createContext<DataContextType | undefined>(undefined)
