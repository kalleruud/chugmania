import type { TrackLevel, TrackType } from '@database/schema'
import { twMerge } from 'tailwind-merge'
import Tag, { type TagProps } from './Tag'

export type TrackTagProps = TagProps &
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
  white: 'text-black bg-white border-white/50',
  green: 'text-green-300 bg-green-500/10 border-green-500/40',
  blue: 'text-sky-300 bg-sky-500/10 border-sky-500/40',
  red: 'text-red-300 bg-red-500/10 border-red-500/40',
  black: 'text-white-300 bg-black/40 border-white/40',
  custom: 'text-amber-300 bg-amber-500/10 border-amber-500/40',
}

const typeClasses: Record<TrackType, string> = {
  drift: 'text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/40',
  valley: 'text-lime-300 bg-lime-500/10 border-lime-500/40',
  lagoon: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/40',
  stadium: 'text-orange-300 bg-orange-500/10 border-orange-500/40',
}

export default function TrackTag({
  selected,
  trackLevel,
  trackType,
  onClick,
  className = '',
  ...rest
}: Readonly<TrackTagProps>) {
  let cls: string = ''

  const colorStyle = trackLevel
    ? levelClasses[trackLevel]
    : typeClasses[trackType]

  const toHover = (tokens: string) =>
    tokens
      .trim()
      .split(' ')
      .map(t => `hover:${t}`)
      .join(' ')

  if (typeof onClick === 'function') {
    cls = twMerge(cls, selected ? colorStyle : toHover(colorStyle))
  } else {
    cls = twMerge(cls, colorStyle)
  }

  return <Tag className={twMerge(cls, className)} onClick={onClick} {...rest} />
}
