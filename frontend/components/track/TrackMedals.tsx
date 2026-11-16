import type { Track } from '@common/models/track'
import type { ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'
import { formatMedalTime, medalTimes } from '../timeentries/timeEntry.groupings'
import MedalIcon from './MedalIcon'

type TrackMedalsProps = {
  track: Track
} & ComponentProps<'div'>

export default function TrackMedals({
  track,
  className,
  ...props
}: Readonly<TrackMedalsProps>) {
  const medals = medalTimes(track)
  if (medals.length === 0) return undefined

  return (
    <div
      className={twMerge('grid grid-cols-2 gap-2 sm:grid-cols-4', className)}
      {...props}>
      {medals.map(([medal, ms]) => (
        <div
          key={medal}
          className='flex items-center justify-center gap-2 py-1'>
          <MedalIcon medal={medal} />
          <span className='font-f1-italic text-sm uppercase tabular-nums'>
            {formatMedalTime(ms)}
          </span>
        </div>
      ))}
    </div>
  )
}
