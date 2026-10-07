import { isRecord } from '../utils/utils'

export type WebhookEventType =
  | 'start'
  | 'first_throttle'
  | 'checkpoint'
  | 'lap'
  | 'respawn'
  | 'finish'
  | 'end'
export type WebhookPlayer = {
  playerIndex: number
  name?: string
  login?: string
  localId?: string
  accountId?: string
}
export type WebhookMap = {
  uid: string
  name: string
  author: string
  environment: string
  type: string
  medalTimesMs: { author: number; gold: number; silver: number; bronze: number }
  isLaps: boolean
  totalLaps?: number
  checkpointsPerLap: number
}
export type WebhookSource = {
  pluginName: string
  pluginVersion: string
  game: 'turbo' | 'next'
}
type BaseEvent = {
  schemaVersion: string
  eventId: string
  sequence: number
  occurredAt: string
  durationMs: number
  game: { gameId: string; totalPlayers: number }
  source: WebhookSource
}
export type WebhookEvent = BaseEvent &
  (
    | {
        type: 'start'
        players: WebhookPlayer[]
        map: WebhookMap | null
        mode: { name: string; type?: string } | null
      }
    | { type: 'first_throttle'; player: WebhookPlayer }
    | {
        type: 'checkpoint' | 'lap' | 'respawn' | 'finish'
        player: WebhookPlayer
        checkpoint: {
          checkpointIndex: number
          checkpointLapIndex: number
          lapNumber: number
          theoreticalDurationMs?: number
          lostMs?: number
        }
      }
    | {
        type: 'end'
        endReason: 'completed' | 'restarted' | 'aborted' | 'unknown'
      }
  )
export type WebhookDraft = {
  gameId: string
  session: string
  kind: 'lap' | 'match'
  map: WebhookMap | null
  track: string | null
  players: {
    playerIndex: number
    name: string
    user: string | null
    finishDurationMs: number | null
    chugDurationMs: number | null
  }[]
  endReason: string | null
  blockers: string[]
}
export type WebhookDrafts = { session: string; drafts: WebhookDraft[] }
export type WebhookGameRequest = { gameId: string }
export type WebhookClaimRequest = WebhookGameRequest & {
  playerIndex: number
  release?: boolean
}
export type WebhookAssignRequest = WebhookGameRequest & {
  playerIndex: number
  user: string | null
}
export type WebhookTrackRequest = WebhookGameRequest & { track: string }

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const semver = /^\d+\.\d+\.\d+$/
const modes = [
  'campaign',
  'arcade',
  'hot-seat',
  'split-screen',
  'secret',
  'solo',
  'unknown',
]
const modeTypes = [
  'time-attack',
  'rounds',
  'laps',
  'cup',
  'royal-time-attack',
  'platform',
  'team',
  'stunts',
  'unknown',
  'split-screen-classic-fun',
  'split-screen-classic-pro',
  'split-screen-smash-fun',
  'split-screen-smash-pro',
  'split-screen-mono-screen-fun',
  'split-screen-mono-screen-pro',
  'split-screen-stunt-fun',
  'split-screen-stunt-pro',
  'split-screen-bonus-fun',
  'split-screen-bonus-pro',
  'arcade-smash',
  'arcade-stunt',
  'hot-seat-smash',
  'hot-seat-stunt',
]
function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}
function integer(value: unknown, min = 0): value is number {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= min
  )
}
function player(value: unknown): value is WebhookPlayer {
  return (
    isRecord(value) &&
    integer(value.playerIndex) &&
    ['name', 'login', 'localId', 'accountId'].every(
      key => value[key] === undefined || nonempty(value[key])
    ) &&
    (value.localId === undefined ||
      (typeof value.localId === 'string' && /^\d+$/.test(value.localId)))
  )
}
function map(value: unknown): value is WebhookMap {
  if (!isRecord(value) || !isRecord(value.medalTimesMs)) return false
  const medals = value.medalTimesMs
  return (
    ['uid', 'name', 'author', 'environment', 'type'].every(key =>
      nonempty(value[key])
    ) &&
    ['author', 'gold', 'silver', 'bronze'].every(key => integer(medals[key])) &&
    typeof value.isLaps === 'boolean' &&
    integer(value.checkpointsPerLap) &&
    (value.totalLaps === undefined ||
      (value.isLaps && integer(value.totalLaps, 1)))
  )
}
export function isWebhookEvent(value: unknown): value is WebhookEvent {
  if (!isRecord(value) || !isRecord(value.game) || !isRecord(value.source))
    return false
  if (
    typeof value.type !== 'string' ||
    typeof value.schemaVersion !== 'string' ||
    !semver.test(value.schemaVersion) ||
    !value.schemaVersion.startsWith('1.') ||
    typeof value.eventId !== 'string' ||
    !uuid.test(value.eventId) ||
    !integer(value.sequence) ||
    typeof value.occurredAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.occurredAt) ||
    !Number.isFinite(Date.parse(value.occurredAt)) ||
    new Date(value.occurredAt).toISOString() !== value.occurredAt ||
    !integer(value.durationMs) ||
    typeof value.game.gameId !== 'string' ||
    !uuid.test(value.game.gameId) ||
    !integer(value.game.totalPlayers, 1) ||
    value.game.totalPlayers > 2 ||
    value.source.pluginName !== 'TM Webhooks' ||
    typeof value.source.pluginVersion !== 'string' ||
    !semver.test(value.source.pluginVersion) ||
    (value.source.game !== 'turbo' && value.source.game !== 'next')
  )
    return false
  if (value.type === 'start') {
    return (
      value.sequence === 0 &&
      value.durationMs === 0 &&
      Array.isArray(value.players) &&
      value.players.length === value.game.totalPlayers &&
      value.players.every(
        (p: unknown, index: number) => player(p) && p.playerIndex === index
      ) &&
      (value.map === null || map(value.map)) &&
      (value.mode === null ||
        (isRecord(value.mode) &&
          typeof value.mode.name === 'string' &&
          modes.includes(value.mode.name) &&
          (value.mode.type === undefined ||
            (typeof value.mode.type === 'string' &&
              modeTypes.includes(value.mode.type)))))
    )
  }
  if (value.type === 'end')
    return (
      typeof value.endReason === 'string' &&
      ['completed', 'restarted', 'aborted', 'unknown'].includes(value.endReason)
    )
  if (
    !player(value.player) ||
    value.player.playerIndex >= value.game.totalPlayers
  )
    return false
  if (value.type === 'first_throttle') return true
  if (
    !['checkpoint', 'lap', 'respawn', 'finish'].includes(value.type) ||
    !isRecord(value.checkpoint)
  )
    return false
  const cp = value.checkpoint
  return (
    integer(cp.checkpointIndex, value.type === 'respawn' ? 0 : 1) &&
    integer(
      cp.checkpointLapIndex,
      value.type === 'finish' || value.type === 'checkpoint' ? 1 : 0
    ) &&
    integer(cp.lapNumber, 1) &&
    (cp.theoreticalDurationMs === undefined ||
      integer(cp.theoreticalDurationMs)) &&
    (cp.lostMs === undefined || integer(cp.lostMs)) &&
    (value.type !== 'lap' || cp.checkpointLapIndex === 0) &&
    (value.type !== 'checkpoint' ||
      (cp.checkpointIndex > 0 && cp.checkpointLapIndex > 0))
  )
}
