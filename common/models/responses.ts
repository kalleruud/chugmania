import type { Leaderboard } from './leaderboard'
import type { Track } from './track'
import type { UserInfo } from './user'

export type BackendResponse =
  | ErrorResponse
  | GetLeaderboardsResponse
  | GetTracksResponse
  | GetUsersResponse
  | LoginResponse
  | SuccessResponse

export type ErrorResponse = {
  success: false
  message: string
}

export type SuccessResponse = {
  success: true
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

export type GetTracksResponse = {
  success: true
  tracks: Track[]
}
