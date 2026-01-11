import { useTimeEntryInput } from '@/hooks/TimeEntryInputProvider'
import loc from '@/lib/locales'
import { getRoundName } from '@/lib/utils'
import type {
  GroupWithPlayers,
  TournamentMatchWithDetails,
} from '@common/models/tournament'
import { twMerge } from 'tailwind-merge'
import MatchRow from '../match/MatchRow'

type TournamentBracketProps = {
  matches: TournamentMatchWithDetails[]
  groups: GroupWithPlayers[]
  className?: string
}

export default function TournamentBracket({
  matches,
  groups: _groups,
  className,
}: Readonly<TournamentBracketProps>) {
  const { openMatch } = useTimeEntryInput()

  const upperBracketMatches = matches.filter(m => m.stage.bracket === 'upper')
  const lowerBracketMatches = matches.filter(m => m.stage.bracket === 'lower')
  const grandFinalMatches = matches.filter(
    m => m.stage.bracket === 'grand_final'
  )

  // Group by stage index
  const upperStageIndices = [
    ...new Set(upperBracketMatches.map(m => m.stage.index)),
  ].sort((a, b) => a - b)
  const lowerStageIndices = [
    ...new Set(lowerBracketMatches.map(m => m.stage.index)),
  ].sort((a, b) => a - b)

  function renderRound(
    roundMatches: TournamentMatchWithDetails[],
    stageIndex: number
  ) {
    const firstMatch = roundMatches[0]
    const roundName = firstMatch
      ? getRoundName(firstMatch.stage.index, firstMatch.stage.bracket)
      : `Runde ${stageIndex + 1}`

    return (
      <div key={stageIndex} className='flex flex-col gap-2'>
        <span className='text-muted-foreground text-xs font-medium'>
          {roundName}
        </span>
        {roundMatches.map(match => {
          if (match.matchDetails) {
            return (
              <MatchRow
                key={match.id}
                item={match.matchDetails}
                className='bg-background rounded-sm border p-2'
                onClick={() => openMatch(match.matchDetails!)}
                hideTrack
              />
            )
          }

          return (
            <div
              key={match.id}
              className='bg-background/50 flex flex-col gap-1 rounded-sm border border-dashed p-3'>
              <span className='text-muted-foreground text-center text-xs'>
                {loc.no.tournament.pending}
              </span>
              <span className='text-muted-foreground text-center text-xs'>
                vs
              </span>
              <span className='text-muted-foreground text-center text-xs'>
                {loc.no.tournament.pending}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className={twMerge('flex flex-col gap-6', className)}>
      {upperBracketMatches.length > 0 && (
        <div className='flex flex-col gap-2'>
          <span className='text-muted-foreground text-xs uppercase'>
            {loc.no.tournament.bracketType.upper}
          </span>
          <div className='grid auto-cols-fr grid-flow-col gap-4 overflow-x-auto'>
            {upperStageIndices.map(stageIndex =>
              renderRound(
                upperBracketMatches.filter(m => m.stage.index === stageIndex),
                stageIndex
              )
            )}
          </div>
        </div>
      )}

      {lowerBracketMatches.length > 0 && (
        <div className='flex flex-col gap-2'>
          <span className='text-muted-foreground text-xs uppercase'>
            {loc.no.tournament.bracketType.lower}
          </span>
          <div className='grid auto-cols-fr grid-flow-col gap-4 overflow-x-auto'>
            {lowerStageIndices.map(stageIndex =>
              renderRound(
                lowerBracketMatches.filter(m => m.stage.index === stageIndex),
                stageIndex
              )
            )}
          </div>
        </div>
      )}

      {grandFinalMatches.length > 0 && (
        <div className='flex flex-col gap-2'>
          <span className='text-muted-foreground text-xs uppercase'>
            {loc.no.tournament.bracketType.grand_final}
          </span>
          <div className='grid auto-cols-fr grid-flow-col gap-4 overflow-x-auto'>
            {renderRound(grandFinalMatches, 0)}
          </div>
        </div>
      )}
    </div>
  )
}
