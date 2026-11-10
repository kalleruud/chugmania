import { isRecord } from '@common/utils/utils'

import type { Event, Map, Player } from './webhook.generated'

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
function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}
function integer(value: unknown, min = 0): value is number {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= min
  )
}
function player(value: unknown): value is Player {
  return isRecord(value) && integer(value.playerIndex)
}
function map(value: unknown): value is Map {
  if (!isRecord(value) || !isRecord(value.medalTimesMs)) return false
  const medals = value.medalTimesMs
  return (
    ['uid', 'name', 'author', 'environment', 'type'].every(key =>
      nonempty(value[key])
    ) &&
    ['author', 'gold', 'silver', 'bronze'].every(key => integer(medals[key])) &&
    typeof value.isLaps === 'boolean' &&
    integer(value.checkpointsPerLap)
  )
}
export function isWebhookEvent(value: unknown): value is Event {
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
          modes.includes(value.mode.name)))
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
    (value.type !== 'lap' || cp.checkpointLapIndex === 0) &&
    (value.type !== 'checkpoint' ||
      (cp.checkpointIndex > 0 && cp.checkpointLapIndex > 0))
  )
}
