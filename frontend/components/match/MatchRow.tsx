import { useData } from '@/contexts/DataContext'
import { useMatch } from '@/hooks/useMatch'
import loc from '@common/locale/locales'
import type { UserInfo } from '@common/models/user'
import { isInactiveFinalReset, stageName } from '@common/utils/tournament'
import { formatTrackName } from '@common/utils/track'
import { CalendarIcon } from '@heroicons/react/24/solid'
import type { ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'
import { NameCellPart } from '../timeentries/TimeEntryRow'
import { Badge } from '../ui/badge'
import { Label } from '../ui/label'
import type { MatchProps } from './MatchProps'

export default function MatchRow({
  className,
  item: match,
  highlight,
  hideTrack,
  children,
  ...rest
}: Readonly<MatchProps>) {
  const { users, tracks, sessions } = useData()
  const { canSetResult, toggleWinner } = useMatch(match)
  const user1 = users?.find(u => u.id === match.user1)
  const user2 = users?.find(u => u.id === match.user2)
  const track = tracks?.find(t => t.id === match.track)
  const session = sessions?.find(s => s.id === match.session)

  const isCancelled = match.status === 'cancelled' && !match.tournament?.awarded
  const isCompleted =
    match.status === 'completed' || !!match.tournament?.awarded
  const isPlanned = match.status === 'planned'

  return (
    <div
      className={twMerge(
        'group relative flex cursor-pointer items-center justify-between rounded-sm p-2 transition-colors',
        isCancelled && 'text-muted-foreground opacity-33',
        className,
        highlight && 'border border-primary/20 bg-primary/5 hover:bg-primary/10'
      )}
      {...rest}>
      <div className='mt-1 grid w-full grid-cols-1 items-center gap-1 sm:grid-cols-2'>
        <div
          className={twMerge(
            'flex w-full items-center justify-center gap-2',
            isCancelled && 'line-through'
          )}>
          <UserCell
            className='min-w-0 flex-1 text-right'
            user={user1}
            slotLabel={match.tournament?.slot1}
            isWinner={!!match.winner && match.winner === match.user1}
            onClick={() => user1 && toggleWinner(user1.id)}
            disabled={
              !canSetResult || isCancelled || match.status !== 'planned'
            }
            isCancelled={isCancelled}
            isCompleted={isCompleted}
          />

          <span
            className={twMerge(
              'mb-1 font-kh-interface text-sm font-black text-muted-foreground/50',
              isCancelled && 'line-through'
            )}>
            {loc.no.match.vs}
          </span>

          <UserCell
            className='min-w-0 flex-1'
            user={user2}
            slotLabel={match.tournament?.slot2}
            isWinner={!!match.winner && match.winner === match.user2}
            onClick={() => user2 && toggleWinner(user2.id)}
            disabled={
              !canSetResult || isCancelled || match.status !== 'planned'
            }
            isCancelled={isCancelled}
            isCompleted={isCompleted}
          />
        </div>

        <div
          className={twMerge(
            'flex items-center justify-center gap-2 sm:justify-start',
            (!track || hideTrack) && !session && !match.stage && 'hidden'
          )}>
          {track && !hideTrack && (
            <div className='flex items-center gap-2'>
              <span
                className={twMerge(
                  'font-kh-interface tabular-nums',
                  isCancelled && 'line-through'
                )}>
                <span className='mr-1 text-primary'>#</span>
                {formatTrackName(track.number)}
              </span>
            </div>
          )}

          {session && (
            <div className='flex items-center gap-1 text-muted-foreground'>
              <CalendarIcon className='size-3' />
              <Label
                className={twMerge('text-xs', isCancelled && 'line-through')}>
                {session.name}
              </Label>
            </div>
          )}

          {match.stage && (
            <Badge
              variant='outline'
              className={twMerge(
                'text-muted-foreground',
                isCancelled && 'line-through'
              )}>
              {match.tournament?.label ?? stageName(match.stage)}
            </Badge>
          )}
        </div>
      </div>
      {children}

      {match.tournament?.awarded && <Badge>{loc.no.tournament.awarded}</Badge>}
      {isInactiveFinalReset(match) && isPlanned && (
        <Badge>{loc.no.tournament.conditional}</Badge>
      )}
    </div>
  )
}

function UserCell({
  user,
  slotLabel,
  isWinner,
  onClick,
  disabled,
  isCancelled,
  isCompleted,
  ...props
}: Readonly<
  {
    user: UserInfo | undefined
    isWinner: boolean
    onClick?: () => void
    slotLabel?: string
    disabled?: boolean
    isCancelled: boolean
    isCompleted: boolean
  } & ComponentProps<'div'>
>) {
  return (
    <div {...props}>
      <button
        type='button'
        disabled={disabled}
        onClick={e => {
          e.stopPropagation()
          onClick?.()
        }}
        className={twMerge(
          'border-b-2 border-transparent px-1 transition-all',
          !isCancelled &&
            !isCompleted &&
            user &&
            'hover:border-b-2 hover:border-primary',
          !isWinner && isCompleted && 'text-muted-foreground',
          isWinner && 'border-primary',
          !user && 'text-muted-foreground opacity-50',
          disabled && 'pointer-events-none',
          isCancelled && 'line-through'
        )}>
        <NameCellPart
          name={
            user?.shortName ??
            user?.lastName ??
            user?.firstName ??
            (slotLabel || loc.no.match.unknownUser)
          }
        />
      </button>
    </div>
  )
}
