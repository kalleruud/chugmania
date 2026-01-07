import { useTimeEntryInput } from '@/hooks/TimeEntryInputProvider'
import loc from '@/lib/locales'
import type { Match } from '@common/models/match'
import type {
  GroupWithPlayers,
  TournamentMatchWithDetails,
} from '@common/models/tournament'
import { twMerge } from 'tailwind-merge'
import MatchRow from '../match/MatchRow'
import TournamentMatchPlaceholder from './TournamentMatchRow'

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
  // Lower bracket: sequential round numbers, lower is earlier (1->2->3->4...)
  const lowerRounds = [...new Set(lowerBracketMatches.map(m => m.round))].sort(
    (a, b) => a - b
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
        sourceA =
          match.sourceMatchAProgression === 'winner'
            ? loc.no.tournament.source.matchWinner(sourceMatch.name)
            : loc.no.tournament.source.matchLoser(sourceMatch.name)
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
        sourceB =
          match.sourceMatchBProgression === 'winner'
            ? loc.no.tournament.source.matchWinner(sourceMatch.name)
            : loc.no.tournament.source.matchLoser(sourceMatch.name)
      }
    }

    return { sourceA, sourceB }
  }

  function renderRound(
    roundMatches: TournamentMatchWithDetails[],
    roundNum: number
  ) {
    return (
      <div key={roundNum} className='flex flex-col gap-2'>
        <span className='text-muted-foreground text-xs font-medium'>
          {roundMatches[0]?.name.replace(/\s\d+$/, '') ?? `Runde ${roundNum}`}
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
            <TournamentMatchPlaceholder
              key={match.id}
              name={match.name}
              sourceA={sourceA}
              sourceB={sourceB}
            />
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
            {renderRound(grandFinalMatches, 1)}
          </div>
        </div>
      )}
    </div>
  )
}
