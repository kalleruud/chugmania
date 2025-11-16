import { Badge } from '@/components/ui/badge'
import { twMerge } from 'tailwind-merge'
import type { TrackLevel, TrackType } from '../../../backend/database/schema'

export type TrackBadgeProps = Parameters<typeof Badge>['0'] &
  (
    | {
        trackLevel: TrackLevel
        trackType?: never
      }
    | {
        trackLevel?: never
        trackType: TrackType
      }
  )

const levelClasses: Record<TrackLevel, string> = {
  white: 'text-black bg-white border-white',
  green: 'text-green-300 bg-green-500/10 border-green-500/20',
  blue: 'text-sky-300 bg-sky-500/10 border-sky-500/20',
  red: 'text-red-300 bg-red-500/10 border-red-500/20',
  black: 'text-white-300 bg-black/40 border-white/40',
  custom: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
}

const typeClasses: Record<TrackType, string> = {
  drift: 'text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/20',
  valley: 'text-lime-300 bg-lime-500/10 border-lime-500/20',
  lagoon: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
  stadium: 'text-orange-300 bg-orange-500/10 border-orange-500/20',
}

export default function TrackBadge({
  trackLevel,
  trackType,
  className,
  ...rest
}: Readonly<TrackBadgeProps>) {
  const colorStyle = trackLevel
    ? levelClasses[trackLevel]
    : typeClasses[trackType]

  return (
    <Badge className={twMerge(colorStyle, className)} {...rest}>
      {trackLevel}
      {trackType}
    </Badge>
  )
}
