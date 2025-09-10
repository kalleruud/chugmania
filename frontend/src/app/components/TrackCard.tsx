import type { Leaderboard } from '@chugmania/common/models/leaderboard.js'
import { formatTrackName } from '@chugmania/common/utils/track.js'
import { Link, type LinkProps } from 'react-router-dom'
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
  const levelRail: Record<string, string> = {
    white: 'from-white to-white/70',
    green: 'from-green-400 to-green-600',
    blue: 'from-sky-400 to-sky-600',
    red: 'from-red-400 to-red-600',
    black: 'from-slate-500 to-slate-800',
    custom: 'from-amber-400 to-amber-600', // yellow-ish for custom
  }

  return (
    <Link
      to={`/tracks/${track.id}`}
      className={
        'group relative block overflow-hidden rounded-xl border border-white/10 bg-white/5 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition hover:border-white/20 hover:bg-white/10' +
        className
      }
      {...rest}
    >
      {/* Accent rail colored by level */}
      <div
        className={`absolute inset-y-0 left-0 w-2 bg-gradient-to-b opacity-70 transition group-hover:opacity-100 ${
          levelRail[track.level] ?? 'from-accent to-accent-secondary/80'
        }`}
      />

      <div className='pl-4'>
        <div className='mb-4 flex items-baseline gap-2'>
          <h3 className='font-f1-black text-accent text-2xl uppercase tracking-wider'>
            {formatTrackName(track.number)}
          </h3>
          <div className='ml-auto text-xs text-slate-300'>
            <span className='rounded-md border border-white/10 bg-white/5 px-2.5 py-1'>
              {totalEntries} laps
            </span>
          </div>
        </div>

        <LeaderboardView entries={entries} />

        <div className='flex items-center gap-2.5 text-slate-300'>
          <TrackTag trackLevel={track.level}>{track.level}</TrackTag>
          <TrackTag trackType={track.type}>{track.type}</TrackTag>
        </div>
      </div>
      {/* Glow on hover */}
      <div
        className='pointer-events-none absolute inset-0 rounded-xl opacity-0 transition group-hover:opacity-100'
        style={{
          boxShadow:
            'inset 0 0 0 1px rgba(255,255,255,0.06), 0 10px 30px -10px rgba(255,255,255,0.08)',
        }}
      />
    </Link>
  )
}
