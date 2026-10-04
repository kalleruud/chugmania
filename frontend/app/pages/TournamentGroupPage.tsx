import MatchList from '@/components/match/MatchList'
import RenameTournamentGroupDialog from '@/components/tournament/RenameTournamentGroupDialog'
import TournamentStandingExplanation from '@/components/tournament/TournamentStandingExplanation'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import UserRow from '@/components/user/UserRow'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import loc from '@common/locale/locales'
import { firstPendingMatch } from '@common/utils/tournament'
import { Link, useParams } from 'react-router'

export default function TournamentGroupPage() {
  const { id, groupId } = useParams()
  const { sessions, tournaments, users, isLoadingData } = useData()
  const { loggedInUser, isLoggedIn } = useAuth()
  if (isLoadingData) {
    return (
      <div className='flex h-dvh items-center justify-center'>
        <Spinner className='size-6' />
      </div>
    )
  }
  const session = sessions.find(session => session.id === id)
  const tournament = tournaments.find(
    tournament => tournament.config.session === id
  )
  const group = tournament?.groups.find(group => group.id === groupId)
  if (!session || !tournament || !group)
    throw new Error(loc.no.tournament.invalidGroup)
  const matches = tournament.matches.filter(
    match => match.tournament?.groupId === group.id
  )
  const featuredMatch = firstPendingMatch(matches)
  const canRename = isLoggedIn && loggedInUser.role !== 'user'

  return (
    <div className='flex min-w-0 flex-col gap-6'>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink to='/sessions'>
              {loc.no.session.title}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink to={`/sessions/${session.id}`}>
              {session.name} · {loc.no.tournament.title}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>
              {loc.no.tournament.group} {group.code}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <header className='flex flex-wrap items-start justify-between gap-4'>
        <div className='min-w-0'>
          <p className='font-f1 text-sm text-muted-foreground uppercase'>
            {loc.no.tournament.group} {group.code}
          </p>
          <h1 className='break-words'>{group.name}</h1>
          <p className='mt-2 text-sm text-muted-foreground'>
            {loc.no.tournament.groupProgress(
              group.progress.decided,
              group.progress.total
            )}
          </p>
        </div>
        {canRename && (
          <RenameTournamentGroupDialog
            key={group.id}
            session={session.id}
            group={group}
          />
        )}
      </header>
      <section className='flex flex-col gap-4 rounded-sm border bg-background p-4'>
        <h2 className='text-xl break-words sm:text-2xl'>
          {loc.no.tournament.groupStandings}
        </h2>
        <p className='text-sm text-muted-foreground'>
          {loc.no.tournament.winPercentageInfo}
        </p>
        {group.standings.map(standing => {
          const user = users.find(user => user.id === standing.user)
          if (!user) return null
          return (
            <div
              key={standing.user}
              className='flex flex-col gap-3 rounded-sm border bg-background-secondary p-3'>
              <UserRow
                item={user}
                rank={standing.rank}
                highlight={standing.qualifies}
              />
              <dl className='grid grid-cols-2 gap-3 text-sm sm:grid-cols-4'>
                <div>
                  <dt className='text-muted-foreground'>
                    {loc.no.tournament.wins}
                  </dt>
                  <dd className='font-bold tabular-nums'>{standing.wins}</dd>
                </div>
                <div>
                  <dt className='text-muted-foreground'>
                    {loc.no.tournament.losses}
                  </dt>
                  <dd className='font-bold tabular-nums'>{standing.losses}</dd>
                </div>
                <div>
                  <dt className='text-muted-foreground'>
                    {loc.no.tournament.matchesPlayed}
                  </dt>
                  <dd className='font-bold tabular-nums'>
                    {standing.matchesPlayed}
                  </dd>
                </div>
                <div>
                  <dt className='text-muted-foreground'>
                    {loc.no.tournament.winPercentage}
                  </dt>
                  <dd className='font-bold tabular-nums'>
                    {standing.winPercentage.toLocaleString('nb-NO', {
                      maximumFractionDigits: 1,
                    })}{' '}
                    %
                  </dd>
                </div>
              </dl>
              <TournamentStandingExplanation
                standing={standing}
                matches={matches}
              />
            </div>
          )
        })}
        <p className='text-sm text-muted-foreground'>
          {loc.no.tournament.groupInfo(tournament.config.advancementCount)}
        </p>
      </section>
      <section className='flex flex-col gap-4 rounded-sm border bg-background p-4'>
        <h2 className='text-xl break-words sm:text-2xl'>
          {loc.no.tournament.groupMatches}
        </h2>
        <MatchList
          matches={matches}
          managed
          trackSeparators
          featuredMatchId={featuredMatch?.id}
        />
      </section>
      <Button asChild variant='outline' className='w-fit'>
        <Link to={`/sessions/${session.id}`}>
          {loc.no.tournament.backToTournament}
        </Link>
      </Button>
    </div>
  )
}
