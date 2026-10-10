import { type Track } from '@common/models/track'
import { formatDateWithYear, formatTimeOnly } from '@common/utils/date'
import { formatTime } from '@common/utils/time'
import { formatTrackLabel } from '@common/utils/track'
import { type ComponentProps, type ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'
import TrackBadge from './TrackBadge'

type TrackCardProps = {
  track: Track
  className?: string
} & ComponentProps<'div'>

function timestamp(date: Date | null): string {
  return date ? `${formatDateWithYear(date)} ${formatTimeOnly(date)}` : '—'
}

function lapMode(isLaps: boolean | null): string {
  if (isLaps === null) return '—'
  return isLaps ? 'Ja' : 'Nei'
}

export default function TrackCard({
  track,
  className,
  ...props
}: Readonly<TrackCardProps>) {
  const fields: { label: string; value: ReactNode }[] = [
    { label: 'Navn', value: track.name },
    { label: 'Banenummer', value: track.number },
    { label: 'Nivå', value: track.level },
    { label: 'Banetype', value: track.type },
    { label: 'Forfatter', value: track.author },
    { label: 'Miljø', value: track.environment },
    { label: 'Karttype', value: track.mapType },
    { label: 'Kart-UID', value: track.uid },
    {
      label: 'Fler-runders bane',
      value: lapMode(track.isLaps),
    },
    { label: 'Antall runder', value: track.totalLaps },
    { label: 'Kontrollpunkter per runde', value: track.checkpointsPerLap },
  ]
  const medals = [
    { label: 'Forfatter', duration: track.authorMedalMs },
    { label: 'Gull', duration: track.goldMedalMs },
    { label: 'Sølv', duration: track.silverMedalMs },
    { label: 'Bronse', duration: track.bronzeMedalMs },
  ]
  return (
    <div className={twMerge('flex flex-col gap-6 p-4', className)} {...props}>
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <h1 className='min-w-0 font-kh-interface text-4xl font-black tracking-tighter wrap-anywhere tabular-nums sm:text-6xl'>
          {formatTrackLabel(track)}
        </h1>
        <div className='flex gap-1'>
          <TrackBadge variant='outline' trackLevel={track.level}>
            {track.level}
          </TrackBadge>
          <TrackBadge
            variant='outline'
            trackType={track.type}
            environment={track.environment}>
            {track.type}
          </TrackBadge>
        </div>
      </div>
      <dl className='grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3'>
        {fields.map(({ label, value }) => (
          <div key={label} className='min-w-0'>
            <dt className='text-muted-foreground'>{label}</dt>
            <dd className='mt-1 wrap-anywhere'>{value ?? '—'}</dd>
          </div>
        ))}
      </dl>
      <section aria-label='Medaljetider' className='flex flex-col gap-2'>
        <h2 className='font-semibold'>Medaljetider</h2>
        <dl className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
          {medals.map(({ label, duration }) => (
            <div key={label} className='rounded-sm border bg-muted/30 p-3'>
              <dt className='text-sm text-muted-foreground'>{label}</dt>
              <dd className='mt-1 font-semibold tabular-nums'>
                {duration === null ? '—' : formatTime(duration)}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <details className='border-t pt-3'>
        <summary className='cursor-pointer text-sm text-muted-foreground'>
          Registreringsdata
        </summary>
        <dl className='mt-3 grid gap-3 text-sm sm:grid-cols-2'>
          <div>
            <dt className='text-muted-foreground'>ID</dt>
            <dd className='wrap-anywhere'>{track.id}</dd>
          </div>
          <div>
            <dt className='text-muted-foreground'>Opprettet</dt>
            <dd>{timestamp(track.createdAt)}</dd>
          </div>
          <div>
            <dt className='text-muted-foreground'>Oppdatert</dt>
            <dd>{timestamp(track.updatedAt)}</dd>
          </div>
          <div>
            <dt className='text-muted-foreground'>Slettet</dt>
            <dd>{timestamp(track.deletedAt)}</dd>
          </div>
        </dl>
      </details>
    </div>
  )
}
