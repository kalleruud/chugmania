import { type Track } from '@common/models/track'
import { formatTrackName } from '@common/utils/track'
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
    <div key={track.id} className={twMerge('flex p-4', className)} {...props}>
      <div className='flex gap-2 font-kh-interface text-6xl font-black tracking-tighter tabular-nums'>
        <p className='text-primary'>#</p>
        {formatTrackName(track.number)}
      </div>

      <div className='flex flex-1 items-end justify-end gap-1'>
        <TrackBadge variant='outline' trackLevel={track.level}>
          {track.level}
        </TrackBadge>
        <TrackBadge variant='outline' trackType={track.type}>
          {track.type}
        </TrackBadge>
      </div>
    </div>
  )
}
