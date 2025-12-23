import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import type { EditMatchRequest, Match } from '@common/models/match'
import type { UserInfo } from '@common/models/user'
import { formatTrackName } from '@common/utils/track'
import { CalendarIcon, MinusIcon } from '@heroicons/react/24/solid'
import type { ComponentProps } from 'react'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'
import type { BaseRowProps } from '../row/RowProps'
import { NameCellPart } from '../timeentries/TimeEntryRow'
import { Badge } from '../ui/badge'
import { Label } from '../ui/label'

export type MatchRowProps = BaseRowProps<Match> & { hideTrack?: boolean }

export default function MatchRow({
  className,
  item: match,
  highlight,
  hideTrack,
  ...rest
}: Readonly<MatchRowProps>) {
  const { users, tracks, sessions } = useData()
  const { socket } = useConnection()
  const { isLoggedIn, loggedInUser } = useAuth()
  const user1 = users?.find(u => u.id === match.user1)
  const user2 = users?.find(u => u.id === match.user2)
  const track = tracks?.find(t => t.id === match.track)
  const session = sessions?.find(s => s.id === match.session)

  const canEdit = isLoggedIn && loggedInUser.role !== 'user'

  const isCancelled = match.status === 'cancelled'
  const isCompleted = match.status === 'completed'
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
        'hover:bg-foreground/15 group relative flex cursor-pointer items-center justify-between rounded-sm p-2 transition-colors',
        isCancelled && 'text-muted-foreground opacity-33',
        className,
        highlight && 'bg-foreground/10 hover:bg-foreground/7'
      )}
      {...rest}>
      <div className='grid w-full grid-cols-1 items-center gap-1 sm:grid-cols-2'>
        <div
          className={twMerge(
            'flex w-full items-center justify-center gap-2',
            isCancelled && 'line-through'
          )}>
          <UserCell
            className='flex-1 text-right'
            user={user1}
            isWinner={!!match.winner && match.winner === match.user1}
            onClick={() => user1 && handleSetWinner(user1.id)}
            disabled={!canEdit || isCancelled || match.status !== 'planned'}
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
            user={user2}
            isWinner={!!match.winner && match.winner === match.user2}
            onClick={() => user2 && handleSetWinner(user2.id)}
            disabled={!canEdit || isCancelled || match.status !== 'planned'}
            isCancelled={isCancelled}
            isCompleted={isCompleted}
          />
        </div>

        <div className='flex items-center justify-center gap-2 sm:justify-start'>
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

          {match.stage && (
            <Badge
              variant='outline'
              className={twMerge(
                'text-muted-foreground',
                isCancelled && 'line-through'
              )}>
              {loc.no.match.stage[match.stage]}
            </Badge>
          )}
        </div>
      </div>

      <div className='absolute right-0 flex items-center'>
        {canEdit && isPlanned && (
          <button
            title={loc.no.match.cancel}
            className='text-muted-foreground hover:text-primary-foreground hover:bg-muted m-2 hidden p-2 transition-colors hover:rounded-sm group-hover:block'
            onClick={e => {
              e.stopPropagation()
              handleCancel()
            }}>
            <MinusIcon className='size-4' />
          </button>
        )}

        {isPlanned && (
          <span className='bg-primary mr-5 size-2 animate-pulse rounded-full group-hover:hidden' />
        )}
      </div>
    </div>
  )
}

function UserCell({
  user,
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
            'hover:border-primary hover:border-b-2',
          !isWinner && isCompleted && 'text-muted-foreground',
          isWinner && 'border-primary',
          !user && 'text-muted-foreground opacity-50',
          disabled && 'pointer-events-none',
          isCancelled && 'line-through'
        )}>
        <NameCellPart
          name={user?.lastName ?? user?.firstName ?? loc.no.match.unknownUser}
        />
      </button>
    </div>
  )
}
