import { isRecord } from '@common/utils/utils'
import type { Event } from './webhook.generated'

export function isWebhookEvent(value: unknown): value is Event {
  return (
    isRecord(value) &&
    typeof value.type === 'string' &&
    [
      'start',
      'end',
      'first_throttle',
      'checkpoint',
      'lap',
      'respawn',
      'finish',
    ].includes(value.type) &&
    typeof value.schemaVersion === 'string' &&
    typeof value.eventId === 'string' &&
    typeof value.sequence === 'number' &&
    Number.isSafeInteger(value.sequence) &&
    value.sequence >= 0 &&
    typeof value.occurredAt === 'string' &&
    typeof value.durationMs === 'number' &&
    Number.isSafeInteger(value.durationMs) &&
    value.durationMs >= 0 &&
    isRecord(value.game) &&
    typeof value.game.gameId === 'string' &&
    typeof value.game.totalPlayers === 'number' &&
    isRecord(value.source)
  )
}
