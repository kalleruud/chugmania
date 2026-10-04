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
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { cn } from '@/lib/utils'
import loc from '@common/locale/locales'
import { getUserFullName } from '@common/models/user'
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
        <div className='overflow-x-auto'>
          <table className='w-full min-w-[32rem] text-sm'>
            <caption className='sr-only'>
              {loc.no.tournament.groupStandings}
            </caption>
            <thead className='border-b text-muted-foreground'>
              <tr>
                <th scope='col' className='px-3 py-2 text-left font-medium'>
                  {loc.no.tournament.rank}
                </th>
                <th scope='col' className='px-3 py-2 text-left font-medium'>
                  {loc.no.user.role.user}
                </th>
                <th scope='col' className='px-3 py-2 text-right font-medium'>
                  {loc.no.tournament.wins}
                </th>
                <th scope='col' className='px-3 py-2 text-right font-medium'>
                  {loc.no.tournament.losses}
                </th>
                <th scope='col' className='px-3 py-2 text-right font-medium'>
                  {loc.no.tournament.matchesPlayed}
                </th>
                <th scope='col' className='px-3 py-2 text-right font-medium'>
                  {loc.no.tournament.winPercentage}
                </th>
              </tr>
            </thead>
            {group.standings.map(standing => {
              const user = users.find(user => user.id === standing.user)
              if (!user) return null
              const progressionBorder = standing.qualifies
                ? 'border-l-primary'
                : 'border-l-transparent'
              return (
                <tbody
                  key={standing.user}
                  className='border-b bg-background-secondary last:border-b-0'>
                  <tr className='tabular-nums'>
                    <td
                      className={cn(
                        'border-l-2 px-3 py-3 font-bold',
                        progressionBorder
                      )}>
                      {standing.rank}
                    </td>
                    <th
                      scope='row'
                      className='max-w-64 min-w-36 px-3 py-3 text-left font-normal'>
                      <Link
                        to={`/users/${user.id}`}
                        className='font-f1 text-xs break-words uppercase underline underline-offset-4 hover:text-primary'>
                        {getUserFullName(user)}
                      </Link>
                    </th>
                    <td className='px-3 py-3 text-right'>{standing.wins}</td>
                    <td className='px-3 py-3 text-right'>{standing.losses}</td>
                    <td className='px-3 py-3 text-right'>
                      {standing.matchesPlayed}
                    </td>
                    <td className='px-3 py-3 text-right font-bold'>
                      {standing.winPercentage.toLocaleString('nb-NO', {
                        maximumFractionDigits: 1,
                      })}{' '}
                      %
                    </td>
                  </tr>
                  <tr>
                    <td
                      colSpan={6}
                      className={cn('border-l-2 px-3 pb-3', progressionBorder)}>
                      <TournamentStandingExplanation
                        standing={standing}
                        matches={matches}
                      />
                    </td>
                  </tr>
                </tbody>
              )
            })}
          </table>
        </div>
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
