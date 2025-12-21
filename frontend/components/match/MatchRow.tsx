import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import type { Match } from '@common/models/match'
import type { UserInfo } from '@common/models/user'
import { formatTrackName } from '@common/utils/track'
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
  const user1 = users?.find(u => u.id === match.user1)
  const user2 = users?.find(u => u.id === match.user2)
  const track = tracks?.find(t => t.id === match.track)

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
        />

        <span className='text-muted-foreground font-kh-interface mt-0.5 text-sm font-black'>
          {loc.no.match.vs}
        </span>

        <UserCell user={user2} isWinner={match.winner === match.user2} />
      </div>
    </div>
  )
}

function UserCell({
  className,
  user,
  isWinner,
}: Readonly<{
  className?: string
  user: UserInfo | undefined
  isWinner: boolean
}>) {
  if (!user) return null
  return (
    <div className={twMerge('flex w-48', className)}>
      <button
        type='button'
        onClick={() => console.log('clicked')}
        className={twMerge(
          'z-10 flex items-center gap-2 rounded-md px-2 py-1 transition-colors',
          !isWinner && 'hover:bg-accent hover:text-accent-foreground',
          isWinner && 'text-primary bg-primary/10 ring-primary ring-2',
          !user && 'opacity-50'
        )}>
        <NameCellPart name={user?.firstName ?? loc.no.match.unknownUser} />
      </button>
    </div>
  )
}
