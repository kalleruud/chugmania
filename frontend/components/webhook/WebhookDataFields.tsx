import { isRecord } from '@common/utils/utils'

const labels: Record<string, string> = {
  players: 'Spillere',
  player: 'Spiller',
  playerIndex: 'Spillerplass',
  name: 'Navn',
  login: 'Brukernavn',
  localId: 'Lokal ID',
  accountId: 'Konto-ID',
  map: 'Bane',
  uid: 'Bane-ID',
  author: 'Forfatter',
  environment: 'Miljø',
  type: 'Type',
  medalTimesMs: 'Medaljetider',
  gold: 'Gull',
  silver: 'Sølv',
  bronze: 'Bronse',
  isLaps: 'Fler-runders bane',
  totalLaps: 'Antall runder',
  checkpointsPerLap: 'Kontrollpunkter per runde',
  mode: 'Spillmodus',
  checkpoint: 'Kontrollpunkt',
  checkpointIndex: 'Kontrollpunkt totalt',
  checkpointLapIndex: 'Kontrollpunkt i runden',
  lapNumber: 'Runde',
  theoreticalDurationMs: 'Teoretisk tid',
  lostMs: 'Tapt tid',
  endReason: 'Avslutningsårsak',
  game: 'Løp',
  gameId: 'Løps-ID',
  totalPlayers: 'Antall spillere',
  source: 'Kilde',
  pluginName: 'Plugin',
  pluginVersion: 'Pluginversjon',
  schemaVersion: 'Dataversjon',
  eventId: 'Hendelses-ID',
}

const endReasons: Record<string, string> = {
  completed: 'Fullført',
  restarted: 'Startet på nytt',
  aborted: 'Avbrutt',
  unknown: 'Ukjent',
}

function displayValue(value: unknown, field: string, milliseconds: boolean) {
  if (value === null || value === undefined) return 'Ikke tilgjengelig'
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nei'
  if (typeof value === 'number') {
    if (milliseconds || field.endsWith('Ms'))
      return `${(value / 1000).toLocaleString('nb-NO', {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      })} s`
    if (field === 'playerIndex') return String(value + 1)
    return value.toLocaleString('nb-NO')
  }
  if (field === 'endReason' && typeof value === 'string')
    return endReasons[value] ?? value
  if (field === 'game' && value === 'turbo') return 'Trackmania Turbo'
  if (field === 'game' && value === 'next') return 'Trackmania Next'
  return typeof value === 'string' ? value : 'Ikke tilgjengelig'
}

export default function WebhookDataFields({
  data,
  field = '',
  milliseconds = false,
}: Readonly<{ data: unknown; field?: string; milliseconds?: boolean }>) {
  if (Array.isArray(data))
    return (
      <div className='flex flex-col gap-3'>
        {data.length === 0 && <p>Ingen oppføringer</p>}
        {data.map((item: unknown, index: number) => (
          <section key={index} className='rounded-sm border p-3'>
            <h4 className='mb-2 text-sm font-semibold'>
              {field === 'players' ? 'Spiller' : 'Oppføring'} {index + 1}
            </h4>
            <WebhookDataFields data={item} milliseconds={milliseconds} />
          </section>
        ))}
      </div>
    )
  if (!isRecord(data))
    return (
      <span className='wrap-anywhere tabular-nums'>
        {displayValue(data, field, milliseconds)}
      </span>
    )
  return (
    <dl className='grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]'>
      {Object.entries(data).map(([key, value]) => {
        const nested = isRecord(value) || Array.isArray(value)
        const label =
          key === 'game' && typeof value === 'string'
            ? 'Spill'
            : (labels[key] ?? key.replace(/([a-z])([A-Z])/g, '$1 $2'))
        return (
          <div
            key={key}
            className={
              nested
                ? 'grid gap-2 sm:col-span-2'
                : 'grid gap-1 sm:col-span-2 sm:grid-cols-subgrid'
            }>
            <dt
              className={
                nested
                  ? 'font-semibold wrap-anywhere'
                  : 'wrap-anywhere text-muted-foreground'
              }>
              {label}
            </dt>
            <dd className='min-w-0'>
              <WebhookDataFields
                data={value}
                field={key}
                milliseconds={milliseconds || key === 'medalTimesMs'}
              />
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
