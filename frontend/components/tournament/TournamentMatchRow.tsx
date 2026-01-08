import { useData } from '@/contexts/DataContext'
import { useTimeEntryInput } from '@/hooks/TimeEntryInputProvider'
import loc from '@/lib/locales'
import type { Match } from '@common/models/match'
import type { TournamentMatch } from '@common/models/tournament'
import type { UserInfo } from '@common/models/user'
import { twMerge } from 'tailwind-merge'
import MatchRow from '../match/MatchRow'

type TournamentMatchRowProps = {
  item: TournamentMatch
  groupName?: string
  className?: string
  previewMatches?: Match[]
  readonly?: boolean
}

export default function TournamentMatchRow({
  item,
  groupName,
  className,
  previewMatches,
  readonly,
}: Readonly<TournamentMatchRowProps>) {
  const { matches, users } = useData()
  const { openMatch } = useTimeEntryInput()
  if (!item) return undefined

  const match = previewMatches
    ? previewMatches.find(m => m.id === item.match)
    : matches?.find(m => m.id === item.match)

  const user1: UserInfo | undefined = match
    ? users?.find(u => u.id === match.user1)
    : undefined
  const user2: UserInfo | undefined = match
    ? users?.find(u => u.id === match.user2)
    : undefined
  const displayName = loc.no.tournament.bracketRoundName(
    item.bracket,
    item.round,
    groupName
  )

  if (match)
    return (
      <div className='bg-background/50 flex w-full flex-col items-center justify-center rounded-sm border p-2'>
        <span>{displayName}</span>
        <MatchRow
          item={match}
          className='w-full'
          onClick={readonly ? undefined : () => openMatch(match)}
          user1Override={user1}
          user2Override={user2}
          readonly={readonly}
        />
      </div>
    )

  return (
    <div
      className={twMerge(
        'bg-background/50 flex flex-col gap-2 rounded-sm border border-dashed p-3',
        className
      )}>
      <div className='flex items-center justify-center gap-2'>
        <span className='text-muted-foreground truncate text-sm'>
          {displayName}
        </span>
      </div>
    </div>
  )
}
