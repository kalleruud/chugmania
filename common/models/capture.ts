import type { unconfirmedLaps } from '../../backend/database/schema'
import type { Session } from './session'
import type { Track } from './track'
import type { User } from './user'

export const CAPTURE_CONTRACT_VERSION = 1

export type CaptureSlotResult = {
  slot: number
  bestTimeMs: number
}

export type CaptureHeatPayload = {
  contractVersion: number
  heatId: string
  mapUid: string
  mapName: string
  mapAuthor?: string
  playerCount: number
  results: CaptureSlotResult[]
  serverTime?: number
}

export type UnconfirmedLap = typeof unconfirmedLaps.$inferSelect

export type UnconfirmedRound = {
  heatId: string
  session: Session['id']
  track: Track['id']
  playerCount: number
  createdAt: Date
  laps: { slot: number; duration: number }[]
}

export type CaptureState = {
  activeSessionId: Session['id'] | null
}

export type CaptureAssignment = {
  slot: number
  user: User['id']
}

export type ConfirmCaptureRequest = {
  type: 'ConfirmCaptureRequest'
  heatId: string
  assignments: CaptureAssignment[]
}

export function isConfirmCaptureRequest(
  data: any
): data is ConfirmCaptureRequest {
  if (typeof data !== 'object' || data === null) return false
  return (
    data.type === 'ConfirmCaptureRequest' &&
    typeof data.heatId === 'string' &&
    Array.isArray(data.assignments)
  )
}

export type DiscardCaptureRequest = {
  type: 'DiscardCaptureRequest'
  heatId: string
}

export function isDiscardCaptureRequest(
  data: any
): data is DiscardCaptureRequest {
  if (typeof data !== 'object' || data === null) return false
  return data.type === 'DiscardCaptureRequest' && typeof data.heatId === 'string'
}

export type SetActiveSessionRequest = {
  type: 'SetActiveSessionRequest'
  sessionId: Session['id'] | null
}

export function isSetActiveSessionRequest(
  data: any
): data is SetActiveSessionRequest {
  if (typeof data !== 'object' || data === null) return false
  return (
    data.type === 'SetActiveSessionRequest' &&
    (typeof data.sessionId === 'string' || data.sessionId === null)
  )
}
