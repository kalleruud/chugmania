import { useData } from '@/contexts/DataContext'
import { useTimeEntryInput } from '@/hooks/TimeEntryInputProvider'
import type { TournamentMatch } from '@common/models/tournament'
import { twMerge } from 'tailwind-merge'
import MatchRow from '../match/MatchRow'

type TournamentMatchRowProps = {
  item: TournamentMatch
  className?: string
}

export default function TournamentMatchRow({
  item,
  className,
}: Readonly<TournamentMatchRowProps>) {
  const { matches } = useData()
  const { openMatch } = useTimeEntryInput()
  const match = matches?.find(m => m.id === item.match)

  if (match)
    return (
      <div className='flex w-full flex-col items-center justify-center rounded-sm border bg-background/50 p-2'>
        <span>{item.name}</span>
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
        'flex flex-col gap-2 rounded-sm border border-dashed bg-background/50 p-3',
        className
      )}>
      <div className='flex items-center justify-center gap-2'>
        <span className='truncate text-sm text-muted-foreground'>
          {item.name}
        </span>
      </div>
    </div>
  )
}
