import { Link, type LinkProps } from 'react-router-dom'
import { twMerge } from 'tailwind-merge'
import type { Leaderboard } from '../../../../common/models/leaderboard'
import { formatTrackName } from '../../../../common/utils/track'
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
  const { track, totalEntries, entries } = leaderboard

  return (
    <Link
      to={`/tracks/${track.id}`}
      className={twMerge(
        'hover:bg-white/6 flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-white/15',
        className
      )}
      {...rest}
    >
      <div className='flex items-center justify-between gap-2'>
        <h3 className='font-f1-black text-accent text-3xl uppercase tracking-wider'>
          {formatTrackName(track.number)}
        </h3>
        <div className='text-xs'>
          <span className='rounded-md border border-white/10 bg-white/5 px-2.5 py-1'>
            {totalEntries} laps
          </span>
        </div>
      </div>

      <div className='flex gap-2'>
        <TrackTag trackLevel={track.level}>{track.level}</TrackTag>
        <TrackTag trackType={track.type}>{track.type}</TrackTag>
      </div>

      <div className='border-b border-white/10' />

      <LeaderboardView entries={entries} />
    </Link>
  )
}
