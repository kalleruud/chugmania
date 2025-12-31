import { useData } from '@/contexts/DataContext'
import type { TournamentMatchWithMatch } from '@common/models/tournament'
import { twMerge } from 'tailwind-merge'

type TournamentMatchPlaceholderRowProps = {
  tournamentMatch: TournamentMatchWithMatch
}

export default function TournamentMatchPlaceholderRow({
  tournamentMatch,
}: Readonly<TournamentMatchPlaceholderRowProps>) {
  const data = useData()

  if (data.isLoadingData) {
    return null
  }

  const { tournaments } = data

  const slot1Text = resolveSlotText(
    tournamentMatch.sourceGroupA,
    tournamentMatch.sourceGroupARank,
    tournamentMatch.sourceMatchA,
    tournamentMatch.sourceMatchAProgression,
    tournaments
  )

  const slot2Text = resolveSlotText(
    tournamentMatch.sourceGroupB,
    tournamentMatch.sourceGroupBRank,
    tournamentMatch.sourceMatchB,
    tournamentMatch.sourceMatchBProgression,
    tournaments
  )

  return (
    <div
      className={twMerge(
        'text-muted-foreground hover:bg-foreground/5 flex items-center justify-between rounded-sm p-2 transition-colors'
      )}>
      <div className='mt-1 grid w-full grid-cols-1 items-center gap-1 sm:grid-cols-2'>
        <div className='flex w-full items-center justify-center gap-2 text-sm italic'>
          <span className='flex-1 text-right'>{slot1Text}</span>
          <span className='font-kh-interface mb-1 text-xs font-black opacity-50'>
            VS
          </span>
          <span className='flex-1'>{slot2Text}</span>
        </div>
      </div>
    </div>
  )
}

function resolveSlotText(
  sourceGroup: string | null,
  sourceGroupRank: number | null,
  sourceMatch: string | null,
  sourceMatchProgression: 'winner' | 'loser' | null,
  tournaments: any[]
): string {
  if (sourceGroup && sourceGroupRank) {
    const group = tournaments
      .flatMap(t => t.groups)
      .find(g => g.id === sourceGroup)

    if (group) {
      const rankLabel = getRankLabel(sourceGroupRank)
      return `${rankLabel} of ${group.name}`
    }

    return `Rank ${sourceGroupRank} of Group`
  }

  if (sourceMatch && sourceMatchProgression) {
    const tournamentMatch = tournaments
      .flatMap(t => t.tournamentMatches)
      .find(tm => tm.id === sourceMatch)

    if (tournamentMatch) {
      const progressionText =
        sourceMatchProgression === 'winner' ? 'Winner' : 'Loser'
      return `${progressionText} of ${tournamentMatch.name}`
    }

    return sourceMatchProgression === 'winner'
      ? 'Winner of Match'
      : 'Loser of Match'
  }

  return 'TBD'
}

function getRankLabel(rank: number): string {
  switch (rank) {
    case 1:
      return '1st'
    case 2:
      return '2nd'
    case 3:
      return '3rd'
    default:
      return `${rank}th`
  }
}
