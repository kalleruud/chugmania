import { DateTime } from 'luxon'
import { Badge } from '../ui/badge'
import WebhookDataFields from './WebhookDataFields'

const eventLabels: Record<string, string> = {
  start: 'Løpet startet',
  first_throttle: 'Første gasspådrag',
  checkpoint: 'Kontrollpunkt passert',
  lap: 'Runde fullført',
  respawn: 'Tilbake til kontrollpunkt',
  finish: 'Målgang',
  end: 'Løpet avsluttet',
}

const metadataKeys = new Set([
  'type',
  'sequence',
  'occurredAt',
  'durationMs',
  'schemaVersion',
  'eventId',
  'game',
  'source',
])

export default function WebhookEventDetails({
  payload,
}: Readonly<{ payload: Record<string, unknown> }>) {
  const title =
    typeof payload.type === 'string'
      ? (eventLabels[payload.type] ?? payload.type)
      : 'Hendelse'
  const occurredAt =
    typeof payload.occurredAt === 'string'
      ? DateTime.fromISO(payload.occurredAt)
          .setZone('Europe/Oslo')
          .setLocale('nb-NO')
          .toFormat('dd.MM.yyyy HH:mm:ss.SSS')
      : 'Ukjent tidspunkt'
  const fields = Object.fromEntries(
    Object.entries(payload).filter(([key]) => !metadataKeys.has(key))
  )
  const metadata = Object.fromEntries(
    Object.entries(payload).filter(([key]) =>
      ['schemaVersion', 'eventId', 'game', 'source'].includes(key)
    )
  )
  return (
    <article className='flex flex-col gap-4 rounded-sm border bg-card p-4'>
      <header className='flex flex-wrap items-center justify-between gap-2'>
        <h3 className='font-semibold'>{title}</h3>
        <Badge variant='outline'>Hendelse {String(payload.sequence)}</Badge>
      </header>
      <dl className='grid gap-3 rounded-sm bg-muted/40 p-3 text-sm sm:grid-cols-2'>
        <div>
          <dt className='text-muted-foreground'>Løpstid</dt>
          <dd className='text-base font-semibold'>
            <WebhookDataFields data={payload.durationMs} field='durationMs' />
          </dd>
        </div>
        <div>
          <dt className='text-muted-foreground'>Tidspunkt (Oslo)</dt>
          <dd className='tabular-nums'>{occurredAt}</dd>
        </div>
      </dl>
      {Object.keys(fields).length > 0 && <WebhookDataFields data={fields} />}
      <details className='border-t pt-3'>
        <summary className='cursor-pointer text-sm text-muted-foreground'>
          Kilde og identifikatorer
        </summary>
        <div className='pt-3'>
          <WebhookDataFields data={metadata} />
        </div>
      </details>
    </article>
  )
}
