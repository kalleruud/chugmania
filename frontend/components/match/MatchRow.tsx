import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import { getRoundName } from '@/lib/utils'
import type {
  DependencySlot,
  EditMatchRequest,
  Match,
  MatchSide,
} from '@common/models/match'
import type {
  TournamentMatchWithDetails,
  TournamentWithDetails,
} from '@common/models/tournament'
import type { UserInfo } from '@common/models/user'
import { formatTrackName } from '@common/utils/track'
import { CalendarIcon, MinusIcon } from '@heroicons/react/24/solid'
import type { ComponentProps } from 'react'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'
import type { BaseRowProps } from '../row/RowProps'
import { NameCellPart } from '../timeentries/TimeEntryRow'
import { Label } from '../ui/label'

export type MatchRowProps = BaseRowProps<Match | undefined> & {
  tournamentMatch?: TournamentMatchWithDetails
  tournament?: TournamentWithDetails
  index?: number
  hideTrack?: boolean
  isReadOnly?: boolean
}

function getUserPlaceholderString(
  _tournamentMatch: TournamentMatchWithDetails | undefined,
  _side: MatchSide,
  _tournament: TournamentWithDetails | undefined
): string {
  // With the new schema, dependency information is stored in matchDependencies table
  // and isn't directly available on the tournament match. For now, show a generic placeholder.
  // TODO: Load and display dependency information if needed
  return loc.no.tournament.pending
}

export default function MatchRow({
  className,
  item: match,
  tournamentMatch,
  tournament,
  index,
  highlight,
  hideTrack,
  isReadOnly,
  ...rest
}: Readonly<MatchRowProps>) {
  const { users, tracks, sessions } = useData()
  const { socket } = useConnection()
  const { isLoggedIn, loggedInUser } = useAuth()

  const stage = tournamentMatch?.stage
  const roundName = stage ? getRoundName(stage.index, stage.bracket) : undefined

  const matchName =
    index === undefined || !roundName
      ? undefined
      : loc.no.tournament.bracketMatchName(roundName, index + 1)

  const track = match?.track
    ? tracks?.find(t => t.id === match?.track)
    : undefined
  const session = match?.session
    ? sessions?.find(s => s.id === match?.session)
    : undefined

  const userA = match?.userA
    ? users?.find(u => u.id === match?.userA)
    : undefined
  const userB = match?.userB
    ? users?.find(u => u.id === match?.userB)
    : undefined

  const canEdit = !isReadOnly && isLoggedIn && loggedInUser.role !== 'user'

  const isCancelled = match?.status === 'cancelled'
  const isCompleted = match?.status === 'completed'
  const isPlanned = match?.status === 'planned'

  function handleSetWinner(side: DependencySlot) {
    if (!canEdit || !match || isReadOnly) return

    const isWinner = match.winner === side
    const newWinner = isWinner ? null : side
    const newStatus = isWinner ? 'planned' : 'completed'

    const payload: EditMatchRequest = {
      type: 'EditMatchRequest',
      id: match.id,
      winner: newWinner,
      status: newStatus,
    }

    toast.promise(
      socket.emitWithAck('edit_match', payload).then(r => {
        if (!r.success) throw new Error(r.message)
      }),
      loc.no.match.toast.update
    )
  }

  function handleCancel() {
    if (!canEdit || !match || isReadOnly) return

    const payload: EditMatchRequest = {
      type: 'EditMatchRequest',
      id: match.id,
      status: 'cancelled',
      winner: null,
    }

    toast.promise(
      socket.emitWithAck('edit_match', payload).then(r => {
        if (!r.success) throw new Error(r.message)
      }),
      loc.no.match.toast.update
    )
  }

  return (
    <div
      className={twMerge(
        'group relative flex items-center justify-between rounded-sm p-2 transition-colors',
        !isReadOnly && 'hover:bg-foreground/15 hover:cursor-pointer',
        isCancelled && 'text-muted-foreground opacity-33',
        className,
        highlight && 'bg-foreground/13'
      )}
      {...rest}>
      <div className='grid w-full items-center gap-1'>
        {matchName && (
          <span className='text-muted-foreground w-full text-center text-xs font-medium'>
            {matchName}
          </span>
        )}

        <div
          className={twMerge(
            'flex w-full items-center justify-center gap-2',
            isCancelled && 'line-through'
          )}>
          <UserCell
            className='flex-1 text-right'
            user={userA}
            placeholder={getUserPlaceholderString(
              tournamentMatch,
              'A',
              tournament
            )}
            isWinner={!!match?.winner && match?.winner === 'A'}
            onClick={() => userA && handleSetWinner('A')}
            disabled={!canEdit || isCancelled || match?.status !== 'planned'}
            isCancelled={isCancelled}
            isCompleted={isCompleted}
          />

          <span
            className={twMerge(
              'text-muted-foreground/50 font-kh-interface mb-1 text-sm font-black',
              isCancelled && 'line-through'
            )}>
            {loc.no.match.vs}
          </span>

          <UserCell
            className='flex-1'
            user={userB}
            placeholder={getUserPlaceholderString(
              tournamentMatch,
              'B',
              tournament
            )}
            isWinner={!!match?.winner && match?.winner === 'B'}
            onClick={() => userB && handleSetWinner('B')}
            disabled={!canEdit || isCancelled || match?.status !== 'planned'}
            isCancelled={isCancelled}
            isCompleted={isCompleted}
          />
        </div>

        <div
          className={twMerge(
            'flex items-center justify-center gap-2',
            (!track || hideTrack) && !session && 'hidden'
          )}>
          {track && !hideTrack && (
            <div className='flex items-center gap-2'>
              <span
                className={twMerge(
                  'font-kh-interface tabular-nums',
                  isCancelled && 'line-through'
                )}>
                <span className='text-primary mr-1'>#</span>
                {formatTrackName(track.number)}
              </span>
            </div>
          )}

          {session && (
            <div className='text-muted-foreground flex items-center gap-1'>
              <CalendarIcon className='size-3' />
              <Label
                className={twMerge('text-xs', isCancelled && 'line-through')}>
                {session.name}
              </Label>
            </div>
          )}
        </div>
      </div>

      <div className='absolute right-0 flex items-center'>
        {canEdit && isPlanned && (
          <button
            title={loc.no.match.cancel}
            className={twMerge(
              'text-muted-foreground m-2 hidden p-2 transition-colors',
              !isReadOnly &&
                'hover:text-primary-foreground hover:bg-muted hover:cursor-pointer hover:rounded-sm group-hover:block'
            )}
            onClick={e => {
              e.stopPropagation()
              handleCancel()
            }}>
            <MinusIcon className='size-4' />
          </button>
        )}

        {isPlanned && (
          <span
            className={twMerge(
              'bg-primary mr-5 size-2 animate-pulse rounded-full',
              !isReadOnly && 'group-hover:hidden'
            )}
          />
        )}
      </div>
    </div>
  )
}

function UserCell({
  user,
  isWinner,
  placeholder,
  onClick,
  disabled,
  isCancelled,
  isCompleted,
  ...props
}: Readonly<
  {
    user: UserInfo | undefined
    placeholder?: string
    isWinner: boolean
    onClick?: () => void
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
          'border-b-2 px-1 transition-all',
          !isCancelled &&
            !isCompleted &&
            user &&
            'hover:border-primary hover:border-b-2',
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
            placeholder ??
            loc.no.match.unknownUser
          }
          isPlaceholder={!user}
        />
      </button>
    </div>
  )
}
