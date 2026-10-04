import { useData } from '@/contexts/DataContext'
import loc from '@common/locale/locales'
import type { Match } from '@common/models/match'
import type { Standing } from '@common/models/tournament'
import { getUserFullName } from '@common/models/user'

export default function TournamentStandingExplanation({
  standing,
  matches,
}: Readonly<{ standing: Standing; matches: Match[] }>) {
  const { users } = useData()
  const explanation = standing.explanation
  const userName = (id: string) => {
    const user = users?.find(user => user.id === id)
    return user ? getUserFullName(user) : id
  }

  if (explanation.kind === 'shared_rank') {
    return (
      <p className='text-sm text-muted-foreground'>
        {loc.no.tournament.sharedRank(
          standing.rank,
          explanation.users.map(userName).join(', ')
        )}{' '}
        {explanation.reason === 'missing_results'
          ? loc.no.tournament.missingDirectResults
          : loc.no.tournament.unresolvedDirectResults}
      </p>
    )
  }
  if (explanation.kind === 'head_to_head') {
    return (
      <div className='flex flex-col gap-1 text-sm text-muted-foreground'>
        <p>{loc.no.tournament.headToHeadRanking}</p>
        <ul className='list-inside list-disc'>
          {explanation.matches.map(evidence => {
            const match = matches.find(match => match.id === evidence.matchId)
            return (
              <li key={evidence.matchId}>
                <a
                  className='underline underline-offset-4 hover:text-foreground'
                  href={`#match-${evidence.matchId}`}>
                  {loc.no.tournament.decidingMatch(
                    match?.tournament?.label ?? loc.no.match.title,
                    userName(evidence.winner),
                    userName(evidence.loser)
                  )}
                </a>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }
  return (
    <p className='text-sm text-muted-foreground'>
      {loc.no.tournament.percentageRanking}
    </p>
  )
}
