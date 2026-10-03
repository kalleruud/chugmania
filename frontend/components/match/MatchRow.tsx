import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import loc from '@common/locale/locales'
import type { EditMatchRequest, Match } from '@common/models/match'
import type { UserInfo } from '@common/models/user'
import { getUserFullName } from '@common/models/user'
import { stageName } from '@common/utils/tournament'
import { formatTrackName } from '@common/utils/track'
import { CalendarIcon, MinusIcon } from '@heroicons/react/24/solid'
import type { ComponentProps } from 'react'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'
import type { BaseRowProps } from '../row/RowProps'
import { NameCellPart } from '../timeentries/TimeEntryRow'
import { Badge } from '../ui/badge'
import { Label } from '../ui/label'

export type MatchRowProps = BaseRowProps<Match> & {
  hideTrack?: boolean
  expanded?: boolean
}

export default function MatchRow({
  className,
  item: match,
  highlight,
  hideTrack,
  expanded,
  children,
  ...rest
}: Readonly<MatchRowProps>) {
  const { users, tracks, sessions } = useData()
  const { socket } = useConnection()
  const { isLoggedIn, loggedInUser } = useAuth()
  const user1 = users?.find(u => u.id === match.user1)
  const user2 = users?.find(u => u.id === match.user2)
  const track = tracks?.find(t => t.id === match.track)
  const session = sessions?.find(s => s.id === match.session)

  const canEdit =
    isLoggedIn && loggedInUser.role !== 'user' && !match.tournament?.readOnly

  const isCancelled = match.status === 'cancelled' && !match.tournament?.awarded
  const isCompleted =
    match.status === 'completed' || !!match.tournament?.awarded
  const isPlanned = match.status === 'planned'

  function handleSetWinner(userId: string) {
    if (!canEdit) return

    const isWinner = match.winner === userId
    const newWinner = isWinner ? null : userId
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
    if (!canEdit) return

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
        'group relative flex cursor-pointer items-center justify-between rounded-sm p-2 transition-colors hover:bg-foreground/15',
        expanded && 'flex-col items-stretch gap-6 p-6 sm:p-8',
        isCancelled && 'text-muted-foreground opacity-33',
        className,
        highlight && 'bg-foreground/3'
      )}
      {...rest}>
      <div
        className={twMerge(
          'mt-1 grid w-full grid-cols-1 items-center gap-1 sm:grid-cols-2',
          expanded && 'gap-6 sm:grid-cols-1'
        )}>
        <div
          className={twMerge(
            'flex w-full items-center justify-center gap-2',
            expanded && 'gap-4 py-4',
            isCancelled && 'line-through'
          )}>
          <UserCell
            className='min-w-0 flex-1 text-right'
            user={user1}
            expanded={expanded}
            slotLabel={match.tournament?.slot1}
            isWinner={!!match.winner && match.winner === match.user1}
            onClick={() => user1 && handleSetWinner(user1.id)}
            disabled={!canEdit || isCancelled || match.status !== 'planned'}
            isCancelled={isCancelled}
            isCompleted={isCompleted}
          />

          <span
            className={twMerge(
              'mb-1 font-kh-interface text-sm font-black text-muted-foreground/50',
              expanded && 'text-2xl text-primary',
              isCancelled && 'line-through'
            )}>
            {loc.no.match.vs}
          </span>

          <UserCell
            className='min-w-0 flex-1'
            user={user2}
            expanded={expanded}
            slotLabel={match.tournament?.slot2}
            isWinner={!!match.winner && match.winner === match.user2}
            onClick={() => user2 && handleSetWinner(user2.id)}
            disabled={!canEdit || isCancelled || match.status !== 'planned'}
            isCancelled={isCancelled}
            isCompleted={isCompleted}
          />
        </div>

        <div
          className={twMerge(
            'flex items-center justify-center gap-2 sm:justify-start',
            expanded && 'flex-wrap gap-3 sm:justify-center',
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
      {match.tournament?.reset === 'conditional' && (
        <Badge>{loc.no.tournament.conditional}</Badge>
      )}
      {match.tournament?.reset === 'unneeded' && (
        <Badge>{loc.no.tournament.unneeded}</Badge>
      )}
      <div
        className={twMerge(
          'absolute right-0 flex items-center',
          expanded && 'top-0'
        )}>
        {canEdit && isPlanned && (
          <button
            type='button'
            title={loc.no.match.cancel}
            className={twMerge(
              'm-2 hidden p-2 text-muted-foreground transition-colors group-hover:block hover:rounded-sm hover:bg-muted hover:text-primary-foreground',
              expanded && 'block'
            )}
            onClick={e => {
              e.stopPropagation()
              handleCancel()
            }}>
            <MinusIcon className='size-4' />
          </button>
        )}

        {isPlanned && (
          <span className='mr-5 size-2 animate-pulse rounded-full bg-primary group-hover:hidden' />
        )}
      </div>
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
  expanded,
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
    expanded?: boolean
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
          expanded && 'max-w-full',
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
            expanded && user
              ? getUserFullName(user)
              : (user?.shortName ??
                user?.lastName ??
                user?.firstName ??
                (slotLabel || loc.no.match.unknownUser))
          }
          className={
            expanded ? 'text-lg whitespace-normal sm:text-3xl' : undefined
          }
        />
      </button>
      {expanded && user && slotLabel && (
        <p className='mt-2 text-sm text-muted-foreground'>{slotLabel}</p>
      )}
    </div>
  )
}
