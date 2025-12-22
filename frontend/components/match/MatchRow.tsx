import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import type { EditMatchRequest, Match } from '@common/models/match'
import type { UserInfo } from '@common/models/user'
import { formatTrackName } from '@common/utils/track'
import { MinusIcon } from '@heroicons/react/24/solid'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'
import type { BaseRowProps } from '../row/RowProps'
import { NameCellPart } from '../timeentries/TimeEntryRow'
import { Badge } from '../ui/badge'

export type MatchRowProps = BaseRowProps<Match>

export default function MatchRow({
  className,
  item: match,
  highlight,
  ...rest
}: Readonly<MatchRowProps>) {
  const { users, tracks } = useData()
  const { socket } = useConnection()
  const { isLoggedIn } = useAuth()
  const user1 = users?.find(u => u.id === match.user1)
  const user2 = users?.find(u => u.id === match.user2)
  const track = tracks?.find(t => t.id === match.track)

  const isCancelled = match.status === 'cancelled'
  const isCompleted = match.status === 'completed'
  const isPlanned = match.status === 'planned'

  function handleSetWinner(userId: string) {
    if (!isLoggedIn) return

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
    if (!isLoggedIn) return

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
        'hover:bg-foreground/5 group relative flex cursor-pointer items-center justify-between rounded-md p-4 transition-colors',
        isCancelled && 'text-muted-foreground opacity-33',
        highlight && 'bg-foreground/3',
        className
      )}
      {...rest}>
      <div className='flex items-center gap-2'>
        {track && (
          <div className='flex items-center gap-2'>
            <span
              className={twMerge(
                'font-kh-interface tabular-nums',
                isCancelled && 'line-through'
              )}>
              <span className='text-primary'>#</span>
              {formatTrackName(track.number)}
            </span>
          </div>
        )}

        {match.stage && (
          <Badge
            variant='outline'
            className={twMerge(isCancelled && 'line-through')}>
            {loc.no.match.stage[match.stage]}
          </Badge>
        )}
      </div>

      <div
        className={twMerge(
          'flex items-center justify-center gap-2',
          isCancelled && 'line-through'
        )}>
        <UserCell
          className='justify-end'
          user={user1}
          isWinner={!!match.winner && match.winner === match.user1}
          onClick={() => user1 && handleSetWinner(user1.id)}
          disabled={!isLoggedIn || isCancelled || match.status !== 'planned'}
          isCancelled={isCancelled}
          isCompleted={isCompleted}
        />

        <span
          className={twMerge(
            'text-muted-foreground font-kh-interface mt-0.5 text-sm font-black',
            isCancelled && 'line-through'
          )}>
          {loc.no.match.vs}
        </span>

        <UserCell
          user={user2}
          className='w-36'
          isWinner={!!match.winner && match.winner === match.user2}
          onClick={() => user2 && handleSetWinner(user2.id)}
          disabled={!isLoggedIn || isCancelled || match.status !== 'planned'}
          isCancelled={isCancelled}
          isCompleted={isCompleted}
        />
      </div>

      <div className='absolute right-0 flex items-center'>
        {isLoggedIn && isPlanned && (
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
  className,
  user,
  isWinner,
  onClick,
  disabled,
  isCancelled,
  isCompleted,
}: Readonly<{
  className?: string
  user: UserInfo | undefined
  isWinner: boolean
  onClick?: () => void
  disabled?: boolean
  isCancelled: boolean
  isCompleted: boolean
}>) {
  return (
    <div className={twMerge('flex', className)}>
      <button
        type='button'
        disabled={disabled}
        onClick={e => {
          e.stopPropagation()
          onClick?.()
        }}
        className={twMerge(
          'flex items-center gap-2 px-1 transition-colors',
          !isWinner && isCompleted && 'text-muted-foreground',
          isWinner && 'border-primary border-b-2',
          !user && 'text-muted-foreground opacity-50',
          disabled && 'pointer-events-none',
          isCancelled && 'line-through'
        )}>
        <NameCellPart name={user?.firstName ?? loc.no.match.unknownUser} />
      </button>
    </div>
  )
}
