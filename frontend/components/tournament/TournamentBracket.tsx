import { useTimeEntryInput } from '@/hooks/TimeEntryInputProvider'
import loc from '@/lib/locales'
import type { Match } from '@common/models/match'
import type {
  GroupWithPlayers,
  TournamentMatchWithDetails,
} from '@common/models/tournament'
import { twMerge } from 'tailwind-merge'
import MatchRow from '../match/MatchRow'

type TournamentBracketProps = {
  matches: TournamentMatchWithDetails[]
  groups: GroupWithPlayers[]
  allMatches: Match[]
  className?: string
}

export default function TournamentBracket({
  matches,
  groups,
  allMatches,
  className,
}: Readonly<TournamentBracketProps>) {
  const { openMatch } = useTimeEntryInput()

  const upperBracketMatches = matches.filter(m => m.bracket === 'upper')
  const lowerBracketMatches = matches.filter(m => m.bracket === 'lower')
  const grandFinalMatches = matches.filter(m => m.bracket === 'grand_final')

  // Upper bracket: higher round numbers are earlier (16->8->4->2->1)
  const upperRounds = [...new Set(upperBracketMatches.map(m => m.round))].sort(
    (a, b) => b - a
  )
  // Lower bracket: higher round numbers are earlier (same as upper bracket)
  const lowerRounds = [...new Set(lowerBracketMatches.map(m => m.round))].sort(
    (a, b) => b - a
  )

  function getSourceDescription(match: TournamentMatchWithDetails): {
    sourceA: string
    sourceB: string
  } {
    let sourceA = loc.no.tournament.pending
    let sourceB = loc.no.tournament.pending

    if (match.sourceGroupA && match.sourceGroupARank) {
      const group = groups.find(g => g.id === match.sourceGroupA)
      if (group) {
        sourceA =
          match.sourceGroupARank === 1
            ? loc.no.tournament.source.groupWinner(group.name)
            : loc.no.tournament.source.groupRank(
                group.name,
                match.sourceGroupARank
              )
      }
    } else if (match.sourceMatchA) {
      const sourceMatch = matches.find(m => m.id === match.sourceMatchA)
      if (sourceMatch) {
        const sourceName = loc.no.tournament.bracketRoundName(
          sourceMatch.bracket,
          sourceMatch.round
        )
        sourceA =
          match.sourceMatchAProgression === 'winner'
            ? loc.no.tournament.source.matchWinner(sourceName)
            : loc.no.tournament.source.matchLoser(sourceName)
      }
    }

    if (match.sourceGroupB && match.sourceGroupBRank) {
      const group = groups.find(g => g.id === match.sourceGroupB)
      if (group) {
        sourceB =
          match.sourceGroupBRank === 1
            ? loc.no.tournament.source.groupWinner(group.name)
            : loc.no.tournament.source.groupRank(
                group.name,
                match.sourceGroupBRank
              )
      }
    } else if (match.sourceMatchB) {
      const sourceMatch = matches.find(m => m.id === match.sourceMatchB)
      if (sourceMatch) {
        const sourceName = loc.no.tournament.bracketRoundName(
          sourceMatch.bracket,
          sourceMatch.round
        )
        sourceB =
          match.sourceMatchBProgression === 'winner'
            ? loc.no.tournament.source.matchWinner(sourceName)
            : loc.no.tournament.source.matchLoser(sourceName)
      }
    }

    return { sourceA, sourceB }
  }

  function renderRound(
    roundMatches: TournamentMatchWithDetails[],
    roundNum: number
  ) {
    const firstMatch = roundMatches[0]
    const roundName = firstMatch
      ? loc.no.tournament.bracketRoundName(firstMatch.bracket, firstMatch.round)
      : `Runde ${roundNum}`

    return (
      <div key={roundNum} className='flex flex-col gap-2'>
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

          const { sourceA, sourceB } = getSourceDescription(match)
          return (
            <div
              key={match.id}
              className='bg-background/50 flex flex-col gap-1 rounded-sm border border-dashed p-3'>
              <span className='text-muted-foreground text-center text-xs'>
                {sourceA}
              </span>
              <span className='text-muted-foreground text-center text-xs'>
                vs
              </span>
              <span className='text-muted-foreground text-center text-xs'>
                {sourceB}
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
            {upperRounds.map(round =>
              renderRound(
                upperBracketMatches.filter(m => m.round === round),
                round
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
            {lowerRounds.map(round =>
              renderRound(
                lowerBracketMatches.filter(m => m.round === round),
                round
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
