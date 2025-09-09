import type { Leaderboard } from './leaderboard'

export type BackendResponse =
  | ErrorResponse
  | GetLeaderboardsResponse
  | LoginResponse
  | RegisterResponse

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
