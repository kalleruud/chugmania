import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import type { EditMatchRequest, Match } from '@common/models/match'
import type { UserInfo } from '@common/models/user'
import { formatTrackName } from '@common/utils/track'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'
import type { BaseRowProps } from '../row/RowProps'
import { NameCellPart } from '../timeentries/TimeEntryRow'

export type MatchRowProps = BaseRowProps<Match>

export default function MatchRow({
  className,
  item: match,
  ...rest
}: Readonly<MatchRowProps>) {
  const { users, tracks } = useData()
  const { socket } = useConnection()
  const { isLoggedIn } = useAuth()
  const user1 = users?.find(u => u.id === match.user1)
  const user2 = users?.find(u => u.id === match.user2)
  const track = tracks?.find(t => t.id === match.track)

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

  return (
    <div
      className={twMerge(
        'hover:bg-foreground/5 relative flex cursor-pointer items-center justify-center rounded-md px-4 py-3',
        className
      )}
      {...rest}>
      {track && (
        <div className='absolute left-4 flex items-center gap-2'>
          <span className='font-kh-interface tabular-nums'>
            #{formatTrackName(track.number)}
          </span>
        </div>
      )}

      <div className='flex w-full items-center justify-center gap-2'>
        <UserCell
          className='justify-end'
          user={user1}
          isWinner={match.winner === match.user1}
          onClick={() => user1 && handleSetWinner(user1.id)}
          disabled={!isLoggedIn}
        />

        <span className='text-muted-foreground font-kh-interface mt-0.5 text-sm font-black'>
          {loc.no.match.vs}
        </span>

        <UserCell
          user={user2}
          isWinner={match.winner === match.user2}
          onClick={() => user2 && handleSetWinner(user2.id)}
          disabled={!isLoggedIn}
        />
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
}: Readonly<{
  className?: string
  user: UserInfo | undefined
  isWinner: boolean
  onClick?: () => void
  disabled?: boolean
}>) {
  if (!user) return null
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
          disabled && 'pointer-events-none'
        )}>
        <NameCellPart name={user?.firstName ?? loc.no.match.unknownUser} />
      </button>
    </div>
  )
}
