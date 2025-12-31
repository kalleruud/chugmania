import type {
  TournamentMatch,
  TournamentWithDetails,
} from '@common/models/tournament'
import type { ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'

type TournamentMatchPlaceholderRowProps = {
  tournamentMatch: TournamentMatch
  tournament: TournamentWithDetails
  className?: string
} & ComponentProps<'div'>

export default function TournamentMatchPlaceholderRow({
  tournamentMatch,
  tournament,
  className,
  ...props
}: Readonly<TournamentMatchPlaceholderRowProps>) {
  function getSourceDescription(
    sourceGroup: string | null,
    sourceGroupRank: number | null,
    sourceMatch: string | null,
    sourceMatchProgression: 'winner' | 'loser' | null
  ): string {
    if (sourceGroup && sourceGroupRank) {
      const group = tournament.groups.find(g => g.id === sourceGroup)
      if (group) {
        const rankText =
          sourceGroupRank === 1
            ? 'Winner'
            : sourceGroupRank === 2
              ? 'Runner-up'
              : `${sourceGroupRank}${getOrdinalSuffix(sourceGroupRank)}`
        return `${rankText} of ${group.name}`
      }
      return `Rank ${sourceGroupRank} from Group`
    }

    if (sourceMatch && sourceMatchProgression) {
      const matchSlot = tournament.tournamentMatches.find(
        tm => tm.id === sourceMatch
      )
      if (matchSlot) {
        return `${sourceMatchProgression === 'winner' ? 'Winner' : 'Loser'} of ${matchSlot.name}`
      }
      return `${sourceMatchProgression === 'winner' ? 'Winner' : 'Loser'} of Match`
    }

    return 'TBD'
  }

  function getOrdinalSuffix(n: number): string {
    const j = n % 10
    const k = n % 100
    if (j === 1 && k !== 11) return 'st'
    if (j === 2 && k !== 12) return 'nd'
    if (j === 3 && k !== 13) return 'rd'
    return 'th'
  }

  const sourceA = getSourceDescription(
    tournamentMatch.sourceGroupA,
    tournamentMatch.sourceGroupARank,
    tournamentMatch.sourceMatchA,
    tournamentMatch.sourceMatchAProgression
  )

  const sourceB = getSourceDescription(
    tournamentMatch.sourceGroupB,
    tournamentMatch.sourceGroupBRank,
    tournamentMatch.sourceMatchB,
    tournamentMatch.sourceMatchBProgression
  )

  return (
    <div
      className={twMerge(
        'text-muted-foreground flex items-center justify-between rounded-sm p-2 opacity-50',
        className
      )}
      {...props}>
      <div className='flex items-center gap-2'>
        <span className='text-sm'>{sourceA}</span>
        <span className='font-kh-interface text-sm font-black'>vs</span>
        <span className='text-sm'>{sourceB}</span>
      </div>
    </div>
  )
}
