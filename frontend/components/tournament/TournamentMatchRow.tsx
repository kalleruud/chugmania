import { useTimeEntryInput } from '@/hooks/TimeEntryInputProvider'
import { getRoundName } from '@/lib/utils'
import type { TournamentMatchWithDetails } from '@common/models/tournament'
import { twMerge } from 'tailwind-merge'
import MatchRow from '../match/MatchRow'

type TournamentMatchRowProps = {
  item: TournamentMatchWithDetails
  index: number | undefined
  className?: string
  isReadOnly?: boolean
}

export default function TournamentMatchRow({
  item: tournamentMatch,
  index,
  className,
  isReadOnly,
}: Readonly<TournamentMatchRowProps>) {
  const { openMatch } = useTimeEntryInput()
  if (!tournamentMatch) return undefined

  const displayName = getRoundName(
    tournamentMatch.round ?? 0,
    tournamentMatch.bracket
  )

  if (tournamentMatch.matchDetails)
    return (
      <MatchRow
        item={tournamentMatch.matchDetails}
        tournamentMatch={tournamentMatch}
        className='w-full'
        onClick={
          isReadOnly
            ? undefined
            : () => openMatch(tournamentMatch.matchDetails!)
        }
        isReadOnly={isReadOnly}
      />
    )

  return (
    <div
      className={twMerge(
        'bg-background/50 flex flex-col items-center justify-center gap-2 rounded-sm border border-dashed py-4',
        className
      )}>
      <span className='text-muted-foreground truncate text-sm'>
        {displayName + (index === undefined ? '' : `, match ${index + 1}`)}
      </span>
    </div>
  )
}
