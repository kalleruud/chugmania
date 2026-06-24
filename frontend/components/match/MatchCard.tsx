import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import type { Match } from '@common/models/match'
import { formatTrackName } from '@common/utils/track'
import { twMerge } from 'tailwind-merge'
import TrackBadge from '../track/TrackBadge'

export type MatchCardProps = {
  match: Match
  onClick?: () => void
  className?: string
}

export default function MatchCard({
  match,
  onClick,
  className,
}: Readonly<MatchCardProps>) {
  const { users, tracks } = useData()
  const user1 = users?.find(u => u.id === match.user1)
  const user2 = users?.find(u => u.id === match.user2)
  const track = tracks?.find(t => t.id === match.track)

  return (
    <button
      type='button'
      onClick={onClick}
      className={twMerge(
        'hover:bg-background-tertiary flex w-full cursor-pointer flex-col items-center justify-center gap-4 rounded-lg border border-transparent bg-background-secondary p-6 transition-colors hover:border-primary/20',
        className
      )}>
      {/* Header: Stage and Status */}
      <div className='flex w-full items-center justify-between text-xs text-muted-foreground uppercase'>
        <span>
          {match.stage ? loc.no.match.stage[match.stage] : ''}
        </span>
        <span>{loc.no.match.status[match.status]}</span>
      </div>

      {/* Match Content */}
      <div className='flex w-full items-center justify-between gap-4'>
        {/* User 1 */}
        <div className='flex flex-1 flex-col items-center gap-1 text-center'>
          <div
            className={twMerge(
              'flex h-12 w-12 items-center justify-center rounded-full border-2 bg-background',
              match.winner === match.user1 && match.user1
                ? 'border-primary text-primary'
                : 'border-border text-muted-foreground'
            )}>
            <span className='font-f1-bold text-lg'>
              {user1?.firstName.charAt(0) ?? '?'}
            </span>
          </div>
          <span
            className={twMerge(
              'font-f1-bold max-w-[120px] truncate text-sm uppercase',
              match.winner === match.user1 && match.user1 && 'text-primary'
            )}>
            {user1?.firstName ?? loc.no.match.unknownUser}
          </span>
        </div>

        {/* VS */}
        <div className='flex flex-col items-center justify-center'>
          <span className='font-kh-interface text-2xl font-bold text-muted-foreground/50'>
            VS
          </span>
        </div>

        {/* User 2 */}
        <div className='flex flex-1 flex-col items-center gap-1 text-center'>
          <div
            className={twMerge(
              'flex h-12 w-12 items-center justify-center rounded-full border-2 bg-background',
              match.winner === match.user2 && match.user2
                ? 'border-primary text-primary'
                : 'border-border text-muted-foreground'
            )}>
            <span className='font-f1-bold text-lg'>
              {user2?.firstName.charAt(0) ?? '?'}
            </span>
          </div>
          <span
            className={twMerge(
              'font-f1-bold max-w-[120px] truncate text-sm uppercase',
              match.winner === match.user2 && match.user2 && 'text-primary'
            )}>
            {user2?.firstName ?? loc.no.match.unknownUser}
          </span>
        </div>
      </div>

      {/* Footer: Track Info */}
      {track && (
        <div className='mt-2 flex items-center justify-center gap-2 rounded-full bg-background/50 px-3 py-1'>
          <span className='font-kh-interface text-sm tabular-nums'>
            #{formatTrackName(track.number)}
          </span>
          <TrackBadge trackLevel={track.level}>{track.level}</TrackBadge>
        </div>
      )}
    </button>
  )
}
