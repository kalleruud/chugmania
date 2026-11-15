import { Badge } from '@/components/ui/badge'
import { twMerge } from 'tailwind-merge'
import type { TrackLevel } from '../../../backend/database/schema'

export type TrackBadgeProps = Parameters<typeof Badge>['0'] &
  (
    | {
        trackLevel: TrackLevel
        environment?: never
      }
    | {
        trackLevel?: never
        environment: string
      }
  )

const levelClasses: Record<TrackLevel, string> = {
  white: 'text-black bg-white border-white',
  green: 'text-green-300 bg-green-950 border-green-900',
  blue: 'text-sky-300 bg-sky-950 border-sky-900',
  red: 'text-red-300 bg-red-950 border-red-900',
  black: 'text-white bg-black border-neutral-600',
  custom: 'text-amber-300 bg-amber-950 border-amber-900',
}

const environmentClasses: Record<string, string> = {
  Canyon: 'text-fuchsia-300 bg-fuchsia-950 border-fuchsia-900',
  Valley: 'text-lime-300 bg-lime-950 border-lime-900',
  Lagoon: 'text-cyan-300 bg-cyan-950 border-cyan-900',
  Stadium: 'text-orange-300 bg-orange-950 border-orange-900',
}

export default function TrackBadge({
  trackLevel,
  environment,
  className,
  ...rest
}: Readonly<TrackBadgeProps>) {
  const colorStyle = trackLevel
    ? levelClasses[trackLevel]
    : (environmentClasses[environment] ??
      'text-muted-foreground bg-muted border-muted')

  return (
    <Badge
      className={twMerge('max-w-full', colorStyle, className)}
      title={trackLevel ?? environment}
      {...rest}>
      <span className='truncate lowercase'>{trackLevel ?? environment}</span>
    </Badge>
  )
}
