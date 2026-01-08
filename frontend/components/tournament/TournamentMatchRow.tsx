import { useData } from '@/contexts/DataContext'
import { useTimeEntryInput } from '@/hooks/TimeEntryInputProvider'
import loc from '@/lib/locales'
import type { TournamentMatch } from '@common/models/tournament'
import { twMerge } from 'tailwind-merge'
import MatchRow from '../match/MatchRow'

type TournamentMatchRowProps = {
  item: TournamentMatch
  groupName?: string
  className?: string
}

export default function TournamentMatchRow({
  item,
  groupName,
  className,
}: Readonly<TournamentMatchRowProps>) {
  const { matches } = useData()
  const { openMatch } = useTimeEntryInput()
  if (!item) return undefined
  const match = matches?.find(m => m.id === item.match)
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
          onClick={() => openMatch(match)}
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
