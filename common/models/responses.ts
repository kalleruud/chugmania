import type { Leaderboard } from './leaderboard'
import type { UserInfo } from './user'
import type { Track } from './track'

export type BackendResponse =
  | ErrorResponse
  | GetLeaderboardsResponse
  | LoginResponse
  | RegisterResponse
  | SearchUsersResponse
  | SearchTracksResponse

export type ErrorResponse = {
  success: false
  message: string
}

export type LoginResponse = {
  success: true
  token: string
}

export type RegisterResponse = {
  success: true
  token: string
}

export type GetLeaderboardsResponse = {
  success: true
  leaderboards: Leaderboard[]
}

export type SearchUsersResponse = {
  success: true
  users: UserInfo[]
}

export type SearchTracksResponse = {
  success: true
  tracks: Track[]
}
