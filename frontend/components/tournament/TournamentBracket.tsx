import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { TournamentMatchWithMatch } from '@common/models/tournament'
import MatchRow from '../match/MatchRow'
import TournamentMatchPlaceholderRow from './TournamentMatchPlaceholderRow'

type TournamentBracketProps = {
  tournamentMatches: TournamentMatchWithMatch[]
}

export default function TournamentBracket({
  tournamentMatches,
}: Readonly<TournamentBracketProps>) {
  const upperBracketMatches = tournamentMatches.filter(
    m => m.bracket === 'upper'
  )
  const lowerBracketMatches = tournamentMatches.filter(
    m => m.bracket === 'lower'
  )
  const groupMatches = tournamentMatches.filter(m => m.bracket === 'group')

  const hasUpper = upperBracketMatches.length > 0
  const hasLower = lowerBracketMatches.length > 0
  const hasGroups = groupMatches.length > 0

  const upperRounds = groupMatchesByRound(upperBracketMatches)
  const lowerRounds = groupMatchesByRound(lowerBracketMatches)
  const groupRounds = groupMatchesByRound(groupMatches)

  if (!hasUpper && !hasLower && !hasGroups) {
    return <p className='text-muted-foreground text-sm'>No matches yet</p>
  }

  return (
    <Tabs defaultValue='upper' className='w-full'>
      <TabsList className='grid w-full grid-cols-3'>
        <TabsTrigger value='groups' disabled={!hasGroups}>
          Groups
        </TabsTrigger>
        <TabsTrigger value='upper' disabled={!hasUpper}>
          Upper Bracket
        </TabsTrigger>
        <TabsTrigger value='lower' disabled={!hasLower}>
          Lower Bracket
        </TabsTrigger>
      </TabsList>

      {hasGroups && (
        <TabsContent value='groups' className='space-y-4'>
          {Object.entries(groupRounds)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([round, matches]) => (
              <div key={round} className='space-y-2'>
                <h4 className='font-f1-bold text-sm uppercase'>
                  Group Matches
                </h4>
                <div className='space-y-1'>
                  {matches.map(tournamentMatch => (
                    <MatchRowOrPlaceholder
                      key={tournamentMatch.id}
                      tournamentMatch={tournamentMatch}
                    />
                  ))}
                </div>
              </div>
            ))}
        </TabsContent>
      )}

      {hasUpper && (
        <TabsContent value='upper' className='space-y-4'>
          {Object.entries(upperRounds)
            .sort(([a], [b]) => Number(b) - Number(a))
            .map(([round, matches]) => (
              <div key={round} className='space-y-2'>
                <h4 className='font-f1-bold text-sm uppercase'>
                  {getRoundName(Number(round))}
                </h4>
                <div className='space-y-1'>
                  {matches.map(tournamentMatch => (
                    <MatchRowOrPlaceholder
                      key={tournamentMatch.id}
                      tournamentMatch={tournamentMatch}
                    />
                  ))}
                </div>
              </div>
            ))}
        </TabsContent>
      )}

      {hasLower && (
        <TabsContent value='lower' className='space-y-4'>
          {Object.entries(lowerRounds)
            .sort(([a], [b]) => Number(b) - Number(a))
            .map(([round, matches]) => (
              <div key={round} className='space-y-2'>
                <h4 className='font-f1-bold text-sm uppercase'>
                  Lower {getRoundName(Number(round))}
                </h4>
                <div className='space-y-1'>
                  {matches.map(tournamentMatch => (
                    <MatchRowOrPlaceholder
                      key={tournamentMatch.id}
                      tournamentMatch={tournamentMatch}
                    />
                  ))}
                </div>
              </div>
            ))}
        </TabsContent>
      )}
    </Tabs>
  )
}

function MatchRowOrPlaceholder({
  tournamentMatch,
}: {
  tournamentMatch: TournamentMatchWithMatch
}) {
  if (tournamentMatch.match) {
    return <MatchRow item={tournamentMatch.match} hideTrack />
  }

  return <TournamentMatchPlaceholderRow tournamentMatch={tournamentMatch} />
}

function groupMatchesByRound(
  matches: TournamentMatchWithMatch[]
): Record<number, TournamentMatchWithMatch[]> {
  return matches.reduce(
    (acc, match) => {
      if (!acc[match.round]) {
        acc[match.round] = []
      }
      acc[match.round].push(match)
      return acc
    },
    {} as Record<number, TournamentMatchWithMatch[]>
  )
}

function getRoundName(round: number): string {
  switch (round) {
    case 1:
      return 'Finals'
    case 2:
      return 'Semi-Finals'
    case 4:
      return 'Quarter-Finals'
    case 8:
      return 'Round of 16'
    default:
      return `Round ${round}`
  }
}
