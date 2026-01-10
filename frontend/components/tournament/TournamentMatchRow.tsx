import { useData } from '@/contexts/DataContext'
import { useTimeEntryInput } from '@/hooks/TimeEntryInputProvider'
import loc from '@/lib/locales'
import type { TournamentMatchWithDetails } from '@common/models/tournament'
import type { UserInfo } from '@common/models/user'
import { twMerge } from 'tailwind-merge'
import MatchRow from '../match/MatchRow'

type TournamentMatchRowProps = {
  item: TournamentMatchWithDetails
  groupName?: string
  className?: string
  readonly?: boolean
}

export default function TournamentMatchRow({
  item: tournamentMatch,
  groupName,
  className,
  readonly,
}: Readonly<TournamentMatchRowProps>) {
  const { users } = useData()
  const { openMatch } = useTimeEntryInput()
  if (!tournamentMatch) return undefined

  const user1: UserInfo | undefined = tournamentMatch.matchDetails
    ? users?.find(u => u.id === tournamentMatch.matchDetails?.user1)
    : undefined

  const user2: UserInfo | undefined = tournamentMatch.matchDetails
    ? users?.find(u => u.id === tournamentMatch.matchDetails?.user2)
    : undefined

  const displayName = loc.no.tournament.bracketRoundName(
    tournamentMatch.bracket,
    tournamentMatch.round ?? 0,
    groupName
  )

  if (tournamentMatch.matchDetails)
    return (
      <div className='bg-background/50 flex w-full flex-col items-center justify-center rounded-sm border p-2'>
        <span>{displayName}</span>
        <MatchRow
          item={tournamentMatch.matchDetails}
          className='w-full'
          onClick={
            readonly
              ? undefined
              : () => openMatch(tournamentMatch.matchDetails!)
          }
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
