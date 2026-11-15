import { trackImageUrl } from '@/lib/track-image'
import { type Track } from '@common/models/track'
import { useState, type ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'
import TrackBadge from './TrackBadge'

type TrackCardProps = {
  track: Track
  className?: string
} & ComponentProps<'div'>

const environmentTints: Record<string, string> = {
  Canyon: 'from-fuchsia-500/25',
  Valley: 'from-lime-500/25',
  Lagoon: 'from-cyan-500/25',
  Stadium: 'from-orange-500/25',
}

export default function TrackCard({
  track,
  className,
  ...props
}: Readonly<TrackCardProps>) {
  const imageUrl = trackImageUrl(track)
  const [failedImageUrl, setFailedImageUrl] = useState<string>()
  const showImage = imageUrl !== undefined && imageUrl !== failedImageUrl
  const tint = environmentTints[track.environment ?? ''] ?? 'from-white/10'

  return (
    <div
      className={twMerge(
        'relative isolate flex min-h-72 min-w-0 items-end gap-4 overflow-hidden rounded-lg bg-black p-4',
        className
      )}
      {...props}>
      {showImage ? (
        <>
          <img
            src={imageUrl}
            alt=''
            onError={() => setFailedImageUrl(imageUrl)}
            className='absolute inset-0 -z-10 size-full object-cover'
          />
          <div className='absolute inset-0 -z-10 bg-linear-to-r from-black via-black/75 to-transparent' />
        </>
      ) : (
        <div
          className={twMerge(
            'absolute inset-0 -z-10 bg-radial-[120%_140%_at_100%_50%] to-transparent to-60%',
            tint
          )}
        />
      )}

      <div
        className={twMerge(
          'flex min-w-0 flex-1 items-baseline gap-2 font-kh-interface text-4xl leading-tight font-black tracking-tighter tabular-nums sm:text-6xl',
          track.name.length > 3 && 'text-3xl sm:text-4xl'
        )}>
        <span className='shrink-0 text-primary'>#</span>
        <span className='min-w-0 [overflow-wrap:anywhere]'>{track.name}</span>
      </div>

      <div className='flex max-w-1/3 min-w-0 flex-wrap justify-end gap-1.5'>
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
