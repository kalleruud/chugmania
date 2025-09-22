import type { Leaderboard } from './leaderboard'
import type { ImportCsvTarget } from './requests'
import type { Track } from './track'
import type { UserInfo } from './user'

export type BackendResponse =
  | ErrorResponse
  | GetLeaderboardsResponse
  | GetTracksResponse
  | GetTrackResponse
  | GetUsersResponse
  | ImportCsvResponse
  | LoginResponse
  | SuccessResponse

export type ErrorResponse = {
  success: false
  message: string
}

export type SuccessResponse = {
  success: true
}

export type ImportCsvResponse = {
  success: true
  summary: {
    target: ImportCsvTarget
    inserted: number
    updated: number
    skipped: number
  }
}

export type LoginResponse = {
  success: true
  token: string
  userInfo: UserInfo
}

export type GetLeaderboardsResponse = {
  success: true
  leaderboards: Leaderboard[]
}

export type GetUsersResponse = {
  success: true
  users: UserInfo[]
}

export type GetTrackResponse = {
  success: true
  track: Track
}

export type GetTracksResponse = {
  success: true
  tracks: Track[]
}
