import { Link } from 'react-router-dom'
import { twMerge } from 'tailwind-merge'
import type { PlayerSummary, PlayerTopResult } from '../../../common/models/playerSummary'
import { getUserFullName } from '../../../common/models/user'
import { formatTime } from '../../../common/utils/time'
import { formatTrackName } from '../../../common/utils/track'

type PlayerCardProps = Readonly<{
  summary: PlayerSummary
  isSelf?: boolean
  className?: string
}>

function renderResult(result: PlayerTopResult) {
  return (
    <li
      key={`${result.trackId}-${result.position}`}
      className='flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-sm'
    >
      <span className='font-f1-bold text-white'>#{result.position}</span>
      <span className='font-f1 text-label-secondary'>{formatTrackName(result.trackNumber)}</span>
      <span className='font-f1-italic text-label-muted'>
        {result.duration != null ? formatTime(result.duration, true) : '—'}
      </span>
    </li>
  )
}

export default function PlayerCard({ summary, isSelf = false, className }: PlayerCardProps) {
  const { user, topResults, averagePosition, totalTracks } = summary
  const headline = (user.shortName ?? getUserFullName(user)) || user.email
  const subtitle = getUserFullName(user)
  const placeholders = Math.max(0, 3 - topResults.length)

  return (
    <Link
      to={`/players/${user.id}`}
      className={twMerge(
        'group flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-white/20 hover:bg-white/10',
        isSelf ? 'border-accent/60 ring-2 ring-accent/30' : '',
        className
      )}
    >
      <div className='flex items-start justify-between gap-4'>
        <div className='flex flex-col gap-1'>
          <h2 className='font-f1-black text-2xl uppercase text-white'>{headline}</h2>
          {subtitle && subtitle !== headline && (
            <p className='text-label-muted text-xs uppercase tracking-wider'>{subtitle}</p>
          )}
        </div>

        <div className='text-right text-xs uppercase tracking-widest text-label-secondary'>
          <span className='block text-[0.6rem]'>Avg pos</span>
          <span className='font-f1-bold text-lg text-white'>
            {averagePosition != null ? averagePosition.toFixed(2) : '—'}
          </span>
          <span className='mt-1 block text-[0.6rem]'>Tracks</span>
          <span className='font-f1-bold text-lg text-white'>{totalTracks}</span>
        </div>
      </div>

      <div className='border-b border-white/10' />

      {topResults.length ? (
        <ul className='flex flex-col gap-2'>
          {topResults.map(renderResult)}
          {Array.from({ length: placeholders }).map((_, index) => (
            <li
              key={`placeholder-${index}`}
              className='flex items-center justify-between gap-3 rounded-xl border border-dashed border-white/10 px-3 py-2 text-sm text-label-muted/60'
            >
              <span>#—</span>
              <span>Awaiting result</span>
              <span>—</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className='text-label-muted text-sm'>No leaderboard entries yet.</p>
      )}
    </Link>
  )
}
