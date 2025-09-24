import { Link, type LinkProps } from 'react-router-dom'
import { twMerge } from 'tailwind-merge'
import type { Leaderboard } from '../../../common/models/leaderboard'
import { formatTrackName } from '../../../common/utils/track'
import LeaderboardView from './Leaderboard'
import TrackTag from './TrackTag'

export type TrackCardProps = Readonly<
  Omit<LinkProps, 'to'> & { leaderboard: Leaderboard }
>

export default function TrackCard({
  leaderboard,
  className,
  ...rest
}: Readonly<TrackCardProps>) {
  const { track, entries } = leaderboard
  const isCustom = track.level === 'custom'

  return (
    <Link
      to={`/tracks/${track.id}`}
      className={twMerge(
        'hover:bg-white/6 flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-white/15',
        isCustom ? 'bg-amber-950/30 hover:bg-amber-950/40' : '',
        className
      )}
      {...rest}
    >
      <div className='flex items-center justify-between gap-2'>
        <h1 className={isCustom ? 'text-amber-600' : undefined}>
          {formatTrackName(track.number)}
        </h1>

        <div className='flex gap-2'>
          <TrackTag trackLevel={track.level}>{track.level}</TrackTag>
          <TrackTag trackType={track.type}>{track.type}</TrackTag>
        </div>
      </div>

      <div className='border-b border-white/10' />

      <LeaderboardView
        entries={entries}
        className='pointer-events-none'
        compact
      />
    </Link>
  )
}
