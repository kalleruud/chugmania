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
  if (!item) return undefined
  const match = matches?.find(m => m.id === item.match)

  if (match)
    return (
      <div className='bg-background/50 flex w-full flex-col items-center justify-center rounded-sm border p-2'>
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
        'bg-background/50 flex flex-col gap-2 rounded-sm border border-dashed p-3',
        className
      )}>
      <div className='flex items-center justify-center gap-2'>
        <span className='text-muted-foreground truncate text-sm'>
          {item.name}
        </span>
        {/* <span className='text-muted-foreground/50 font-kh-interface text-xs font-black'>
          {loc.no.match.vs}
        </span>
        <span className='text-muted-foreground truncate text-sm'>
          {sourceB}
        </span> */}
      </div>
    </div>
  )
}
