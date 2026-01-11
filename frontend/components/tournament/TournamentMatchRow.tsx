import { useTimeEntryInput } from '@/hooks/TimeEntryInputProvider'
import { getRoundName } from '@/lib/utils'
import type { TournamentMatchWithDetails } from '@common/models/tournament'
import type { ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'
import MatchRow from '../match/MatchRow'

type TournamentMatchRowProps = {
  item: TournamentMatchWithDetails
  index: number | undefined
  className?: string
  isReadOnly?: boolean
} & ComponentProps<'div'>

export default function TournamentMatchRow({
  item: tournamentMatch,
  index,
  className,
  isReadOnly,
  ...props
}: Readonly<TournamentMatchRowProps>) {
  const { openMatch } = useTimeEntryInput()
  if (!tournamentMatch) return undefined

  if (tournamentMatch.matchDetails)
    return (
      <MatchRow
        item={tournamentMatch.matchDetails}
        tournamentMatch={tournamentMatch}
        className={twMerge('w-full', className)}
        onClick={
          isReadOnly
            ? undefined
            : () => openMatch(tournamentMatch.matchDetails!)
        }
        isReadOnly={isReadOnly}
        {...props}
      />
    )

  const displayName = getRoundName(
    tournamentMatch.round ?? 0,
    tournamentMatch.bracket
  )

  return (
    <div
      className={twMerge(
        'bg-background/50 flex flex-col items-center justify-center gap-2 rounded-sm border border-dashed py-4',
        className
      )}
      {...props}>
      <span className='text-muted-foreground truncate text-sm'>
        {displayName + (index === undefined ? '' : `, match ${index + 1}`)}
      </span>
    </div>
  )
}
