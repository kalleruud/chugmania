import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import type { EditMatchRequest, Match } from '@common/models/match'
import type { UserInfo } from '@common/models/user'
import { formatTrackName } from '@common/utils/track'
import { XMarkIcon } from '@heroicons/react/24/solid'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'
import type { BaseRowProps } from '../row/RowProps'
import { NameCellPart } from '../timeentries/TimeEntryRow'

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
        'hover:bg-foreground/5 group relative flex cursor-pointer items-center justify-center rounded-md px-4 py-3 transition-colors',
        isCancelled && 'text-muted-foreground opacity-33',
        highlight && 'ring-primary/50 ring-1',
        className
      )}
      {...rest}>
      {track && (
        <div className='absolute left-4 flex items-center gap-2'>
          <span
            className={twMerge(
              'font-kh-interface tabular-nums',
              isCancelled && 'line-through'
            )}>
            #{formatTrackName(track.number)}
          </span>
        </div>
      )}

      <div
        className={twMerge(
          'flex w-full items-center justify-center gap-2',
          isCancelled && 'line-through'
        )}>
        <UserCell
          className='justify-end'
          user={user1}
          isWinner={!!match.winner && match.winner === match.user1}
          onClick={() => user1 && handleSetWinner(user1.id)}
          disabled={!isLoggedIn || isCancelled || match.status !== 'planned'}
          isCancelled={isCancelled}
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
          isWinner={!!match.winner && match.winner === match.user2}
          onClick={() => user2 && handleSetWinner(user2.id)}
          disabled={!isLoggedIn || isCancelled || match.status !== 'planned'}
          isCancelled={isCancelled}
        />
      </div>

      {isLoggedIn && match.status !== 'completed' && !isCancelled && (
        <button
          className='text-muted-foreground hover:text-muted-foreground/80 absolute right-0 hidden p-4 transition-colors group-hover:block'
          onClick={e => {
            e.stopPropagation()
            handleCancel()
          }}>
          <XMarkIcon className='size-4' />
        </button>
      )}
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
}: Readonly<{
  className?: string
  user: UserInfo | undefined
  isWinner: boolean
  onClick?: () => void
  disabled?: boolean
  isCancelled?: boolean
}>) {
  return (
    <div className={twMerge('flex w-48', className)}>
      <button
        type='button'
        disabled={disabled}
        onClick={e => {
          e.stopPropagation()
          onClick?.()
        }}
        className={twMerge(
          'z-10 flex items-center gap-2 rounded-md px-2 py-1 transition-colors',
          !isWinner && 'hover:bg-accent hover:text-accent-foreground',
          isWinner && 'bg-primary/10 ring-primary hover:bg-primary ring-2',
          !user && 'opacity-50',
          disabled && 'pointer-events-none',
          isCancelled && 'line-through'
        )}>
        <NameCellPart name={user?.firstName ?? loc.no.match.unknownUser} />
      </button>
    </div>
  )
}
