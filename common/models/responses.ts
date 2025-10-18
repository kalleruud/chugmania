import type { Leaderboard } from './leaderboard'
import type { PlayerDetail } from './playerDetail'
import type { PlayerSummary } from './playerSummary'
import type { Track } from './track'
import type { UserInfo } from './user'

export type BackendResponse =
  | ErrorResponse
  | GetLeaderboardsResponse
  | GetTracksResponse
  | GetTrackResponse
  | GetUsersResponse
  | GetPlayerSummariesResponse
  | GetPlayerDetailsResponse
  | LoginResponse
  | UpdateUserResponse
  | SuccessResponse

export type ErrorResponse = {
  success: false
  message: string
}

export type SuccessResponse = {
  success: true
  message?: string
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

export type GetPlayerSummariesResponse = {
  success: true
  players: PlayerSummary[]
}

export type GetPlayerDetailsResponse = {
  success: true
  player: PlayerDetail
}

export type UpdateUserResponse = {
  success: true
  userInfo: UserInfo
  token?: string
}
