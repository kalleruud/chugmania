import { type Track } from '@common/models/track'
import { type ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'
import TrackBadge from './TrackBadge'

type TrackCardProps = {
  track: Track
  className?: string
} & ComponentProps<'div'>

export default function TrackCard({
  track,
  className,
  ...props
}: Readonly<TrackCardProps>) {
  return (
    <div
      className={twMerge(
        'flex min-w-0 flex-col gap-4 p-4 md:flex-row md:items-end',
        className
      )}
      {...props}>
      <div
        className={twMerge(
          'flex min-w-0 flex-1 items-baseline gap-2 font-kh-interface text-4xl leading-tight font-black tracking-tighter tabular-nums sm:text-6xl',
          track.name.length > 3 && 'text-3xl sm:text-4xl'
        )}>
        <span className='shrink-0 text-primary'>#</span>
        <span className='min-w-0 [overflow-wrap:anywhere]'>{track.name}</span>
      </div>

      <div className='flex min-w-0 flex-wrap gap-1.5 md:max-w-1/3 md:justify-end'>
        {track.level && (
          <TrackBadge variant='outline' trackLevel={track.level} />
        )}
        {track.environment && (
          <TrackBadge variant='outline' environment={track.environment} />
        )}
      </div>
    </div>
  )
}
