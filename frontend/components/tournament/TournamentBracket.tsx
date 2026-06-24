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

function getGroupSourceDescription(
  groups: GroupWithPlayers[],
  groupId: string | null,
  rank: number | null
): string | undefined {
  if (!groupId || !rank) return undefined

  const group = groups.find(g => g.id === groupId)
  if (!group) return undefined

  if (rank === 1) return loc.no.tournament.source.groupWinner(group.name)
  return loc.no.tournament.source.groupRank(group.name, rank)
}

function getMatchSourceDescription(
  matches: TournamentMatchWithDetails[],
  matchId: string | null,
  progression: string | null
): string | undefined {
  if (!matchId) return undefined

  const sourceMatch = matches.find(m => m.id === matchId)
  if (!sourceMatch) return undefined

  if (progression === 'winner') {
    return loc.no.tournament.source.matchWinner(sourceMatch.name)
  }

  return loc.no.tournament.source.matchLoser(sourceMatch.name)
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
    const sourceA =
      getGroupSourceDescription(
        groups,
        match.sourceGroupA,
        match.sourceGroupARank
      ) ??
      getMatchSourceDescription(
        matches,
        match.sourceMatchA,
        match.sourceMatchAProgression
      ) ??
      loc.no.tournament.pending

    const sourceB =
      getGroupSourceDescription(
        groups,
        match.sourceGroupB,
        match.sourceGroupBRank
      ) ??
      getMatchSourceDescription(
        matches,
        match.sourceMatchB,
        match.sourceMatchBProgression
      ) ??
      loc.no.tournament.pending

    return { sourceA, sourceB }
  }

  function renderRound(
    roundMatches: TournamentMatchWithDetails[],
    roundNum: number
  ) {
    return (
      <div key={roundNum} className='flex flex-col gap-2'>
        <span className='text-xs font-medium text-muted-foreground'>
          {roundMatches[0]?.name.replace(/\s\d+$/, '') ?? `Runde ${roundNum}`}
        </span>
        {roundMatches.map(match => {
          if (match.matchDetails) {
            return (
              <MatchRow
                key={match.id}
                item={match.matchDetails}
                className='rounded-sm border bg-background p-2'
                onClick={() => {
                  if (match.matchDetails) openMatch(match.matchDetails)
                }}
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
          <span className='text-xs text-muted-foreground uppercase'>
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
          <span className='text-xs text-muted-foreground uppercase'>
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
    </div>
  )
}
