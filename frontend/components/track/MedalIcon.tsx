import loc from '@common/locale/locales'
import { twMerge } from 'tailwind-merge'
import type { Medal } from '../timeentries/timeEntry.groupings'

const medalColors: Record<Medal, string> = {
  author: 'bg-medal-author',
  gold: 'bg-medal-gold',
  silver: 'bg-medal-silver',
  bronze: 'bg-medal-bronze',
}

type MedalIconProps = {
  medal: Medal
  className?: string
}

export default function MedalIcon({
  medal,
  className,
}: Readonly<MedalIconProps>) {
  return (
    <span
      role='img'
      aria-label={loc.no.timeEntry.medals[medal]}
      className={twMerge(
        'inline-block size-5 shrink-0 mask-[url(/medals/medal.svg)] mask-contain mask-center mask-no-repeat',
        medalColors[medal],
        className
      )}
    />
  )
}
