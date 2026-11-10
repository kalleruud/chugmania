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
    typeof value.occurredAt === 'string' &&
    typeof value.durationMs === 'number' &&
    isRecord(value.game) &&
    typeof value.game.gameId === 'string' &&
    typeof value.game.totalPlayers === 'number' &&
    isRecord(value.source)
  )
}
