import { Link } from 'react-router-dom'
import { twMerge } from 'tailwind-merge'
import type { PlayerSummary } from '../../../common/models/playerSummary'
import type { LeaderboardEntry } from '../../../common/models/timeEntry'
import { getUserFullName } from '../../../common/models/user'
import { formatTrackName } from '../../../common/utils/track'
import TimeEntryRow from './TimeEntryRow'
import TrackTag from './TrackTag'

type PlayerCardProps = Readonly<{
  summary: PlayerSummary
  isSelf?: boolean
  className?: string
}>

export default function PlayerCard({
  summary,
  isSelf = false,
  className,
}: PlayerCardProps) {
  const { user, topResults, averagePosition, totalTracks } = summary
  const headline = (user.shortName ?? getUserFullName(user)) || user.email
  const subtitle = getUserFullName(user)
  const placeholders = Math.max(0, 3 - topResults.length)

  const leaderboardEntries: LeaderboardEntry[] = topResults.map(result => ({
    id: `${user.id}-${result.trackId}-${result.position}`,
    duration: result.duration ?? null,
    amount: 0,
    comment: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    user,
    gap: {
      position: result.position ?? undefined,
    },
  }))

  return (
    <Link
      to={`/players/${user.id}`}
      className={twMerge(
        'group flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-white/20 hover:bg-white/10',
        isSelf ? 'border-accent/60 ring-accent/30 ring-2' : '',
        className
      )}
    >
      <div className='flex items-start justify-between gap-4'>
        <div className='flex flex-col gap-1'>
          <h2 className='font-f1-black text-2xl uppercase text-white'>
            {headline}
          </h2>
          {subtitle && subtitle !== headline && (
            <p className='text-label-muted text-xs uppercase tracking-wider'>
              {subtitle}
            </p>
          )}
        </div>

        <div className='text-label-secondary text-right text-xs uppercase tracking-widest'>
          <span className='block text-[0.6rem]'>Avg pos</span>
          <span className='font-f1-bold text-lg text-white'>
            {averagePosition != null ? averagePosition.toFixed(2) : '—'}
          </span>
          <span className='mt-1 block text-[0.6rem]'>Tracks</span>
          <span className='font-f1-bold text-lg text-white'>{totalTracks}</span>
        </div>
      </div>

      <div className='border-b border-white/10' />

      {leaderboardEntries.length ? (
        <div className='flex flex-col gap-3'>
          {leaderboardEntries.map((entry, index) => {
            const result = topResults[index]!

            return (
              <div
                key={entry.id}
                className='space-y-2 rounded-xl border border-white/10 bg-black/30 p-3'
              >
                <div className='text-label-secondary flex items-center justify-between gap-2 text-xs uppercase tracking-[0.25em]'>
                  <span className='font-f1 text-sm text-white'>
                    {formatTrackName(result.trackNumber)}
                  </span>
                  <div className='text-label-muted flex gap-2 text-[0.6rem] uppercase tracking-[0.3em]'>
                    <span>#{result.position ?? '—'}</span>
                    <TrackTag trackLevel={result.trackLevel}>
                      {result.trackLevel}
                    </TrackTag>
                    <TrackTag trackType={result.trackType}>
                      {result.trackType}
                    </TrackTag>
                  </div>
                </div>

                <table className='flex w-full flex-col'>
                  <tbody className='flex flex-col'>
                    <TimeEntryRow
                      lapTime={entry}
                      position={result.position ?? undefined}
                      showGap={false}
                      showDate={false}
                      className='rounded-lg border border-white/10 bg-white/5 px-3 py-2'
                    />
                  </tbody>
                </table>
              </div>
            )
          })}

          {Array.from({ length: placeholders }).map((_, index) => (
            <div
              key={`placeholder-${index}`}
              className='text-label-muted/60 flex items-center justify-between gap-3 rounded-xl border border-dashed border-white/10 px-3 py-2 text-sm'
            >
              <span>#—</span>
              <span>Awaiting result</span>
              <span>—</span>
            </div>
          ))}
        </div>
      ) : (
        <p className='text-label-muted text-sm'>No leaderboard entries yet.</p>
      )}
    </Link>
  )
}
