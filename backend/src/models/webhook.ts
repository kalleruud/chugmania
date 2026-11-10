import { isRecord } from '@common/utils/utils'
import type { Event, Map, Mode, Player } from './webhook.generated'

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string'
}

function isPlayer(value: unknown, totalPlayers: number): value is Player {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.playerIndex) &&
    value.playerIndex < totalPlayers &&
    isOptionalString(value.name) &&
    isOptionalString(value.login) &&
    isOptionalString(value.localId) &&
    isOptionalString(value.accountId)
  )
}

function isMap(value: unknown): value is Map {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    typeof value.uid === 'string' &&
    value.uid.length > 0 &&
    typeof value.author === 'string' &&
    typeof value.environment === 'string' &&
    typeof value.type === 'string' &&
    isRecord(value.medalTimesMs) &&
    isNonNegativeInteger(value.medalTimesMs.author) &&
    isNonNegativeInteger(value.medalTimesMs.gold) &&
    isNonNegativeInteger(value.medalTimesMs.silver) &&
    isNonNegativeInteger(value.medalTimesMs.bronze) &&
    typeof value.isLaps === 'boolean' &&
    (value.totalLaps === undefined ||
      (isNonNegativeInteger(value.totalLaps) && value.totalLaps > 0)) &&
    isNonNegativeInteger(value.checkpointsPerLap)
  )
}

function isMode(value: unknown): value is Mode {
  if (!isRecord(value)) return false
  const names: Mode['name'][] = [
    'campaign',
    'arcade',
    'hot-seat',
    'split-screen',
    'secret',
    'solo',
    'unknown',
  ]
  const types: NonNullable<Mode['type']>[] = [
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
  return (
    names.some(name => name === value.name) &&
    (value.type === undefined || types.some(type => type === value.type))
  )
}

export function isWebhookEvent(value: unknown): value is Event {
  if (
    !isRecord(value) ||
    typeof value.schemaVersion !== 'string' ||
    !value.schemaVersion ||
    typeof value.eventId !== 'string' ||
    !value.eventId ||
    !isNonNegativeInteger(value.sequence) ||
    typeof value.occurredAt !== 'string' ||
    !Number.isFinite(Date.parse(value.occurredAt)) ||
    !isNonNegativeInteger(value.durationMs) ||
    !isRecord(value.game) ||
    typeof value.game.gameId !== 'string' ||
    !value.game.gameId ||
    (value.game.totalPlayers !== 1 && value.game.totalPlayers !== 2) ||
    !isRecord(value.source) ||
    value.source.pluginName !== 'TM Webhooks' ||
    typeof value.source.pluginVersion !== 'string' ||
    !value.source.pluginVersion ||
    (value.source.game !== 'turbo' && value.source.game !== 'next')
  )
    return false

  const totalPlayers = value.game.totalPlayers
  switch (value.type) {
    case 'start':
      return (
        Array.isArray(value.players) &&
        value.players.length === totalPlayers &&
        value.players.every(
          (player: unknown, index: number) =>
            isPlayer(player, totalPlayers) && player.playerIndex === index
        ) &&
        (value.map === null || isMap(value.map)) &&
        (value.mode === null || isMode(value.mode))
      )
    case 'end':
      return (
        typeof value.endReason === 'string' &&
        ['completed', 'restarted', 'aborted', 'unknown'].includes(
          value.endReason
        )
      )
    case 'first_throttle':
      return isPlayer(value.player, totalPlayers)
    case 'checkpoint':
    case 'lap':
    case 'respawn':
    case 'finish':
      return (
        isPlayer(value.player, totalPlayers) &&
        isRecord(value.checkpoint) &&
        isNonNegativeInteger(value.checkpoint.checkpointIndex) &&
        isNonNegativeInteger(value.checkpoint.checkpointLapIndex) &&
        isNonNegativeInteger(value.checkpoint.lapNumber) &&
        value.checkpoint.lapNumber > 0 &&
        (value.checkpoint.theoreticalDurationMs === undefined ||
          isNonNegativeInteger(value.checkpoint.theoreticalDurationMs)) &&
        (value.checkpoint.lostMs === undefined ||
          isNonNegativeInteger(value.checkpoint.lostMs))
      )
    default:
      return false
  }
}
