import MatchList from '@/components/match/MatchList'
import RenameTournamentGroupDialog from '@/components/tournament/RenameTournamentGroupDialog'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { cn } from '@/lib/utils'
import loc from '@common/locale/locales'
import { firstPendingMatch } from '@common/utils/tournament'
import { ChevronRight } from 'lucide-react'
import { Fragment } from 'react'
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
    tournament =>
      tournament.config.session === id && tournament.status === 'started'
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
            <BreadcrumbLink to='/'>{loc.no.common.home}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink to='/sessions'>
              {loc.no.session.title}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink to={`/sessions/${session.id}`}>
              {session.name}
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

      <header className='flex flex-wrap items-end justify-between gap-4'>
        <div className='min-w-0'>
          <p className='font-f1 text-sm text-muted-foreground uppercase'>
            {loc.no.tournament.group} {group.code}
          </p>
          <h1 className='wrap-break-word'>{group.name}</h1>
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

      <section>
        <div className='rounded border bg-background-secondary px-1'>
          <table className='table-auto border-separate border-spacing-x-4 border-spacing-y-3'>
            <caption className='sr-only'>
              {loc.no.tournament.groupStandings}
            </caption>

            <thead className='border-b text-sm text-muted-foreground'>
              <tr>
                <th scope='col' className='text-left font-medium'>
                  {loc.no.tournament.rank}
                </th>
                <th scope='col' className='w-full text-left font-medium'>
                  {loc.no.user.role.user}
                </th>
                <th scope='col' className='text-right font-medium'>
                  {loc.no.tournament.wins}
                </th>
                <th scope='col' className='text-right font-medium'>
                  {loc.no.tournament.losses}
                </th>
                <th scope='col' className='text-right font-medium'>
                  {loc.no.tournament.matchesPlayed}
                </th>
                <th scope='col' className='font-medium'>
                  {loc.no.tournament.winPercentage}
                </th>
              </tr>
            </thead>

            <tbody>
              {group.standings.map(standing => {
                const user = users.find(user => user.id === standing.user)
                if (!user) return null

                return (
                  <Fragment key={standing.user}>
                    <tr className='tabular-nums'>
                      <td
                        className={cn(
                          'text-center font-kh-interface font-bold',
                          standing.rank <= tournament.config.advancementCount &&
                            'text-primary'
                        )}>
                        {standing.rank}
                      </td>
                      <th
                        scope='row'
                        className='-ml-2 block min-w-0 flex-1 truncate text-start font-f1 uppercase'>
                        <Button variant='ghost' size='sm' asChild>
                          <Link to={'/users/' + user.id}>
                            <span className='font-bold sm:hidden'>
                              {user.shortName || user.firstName}
                            </span>
                            <span className='mr-1 hidden font-medium sm:inline'>
                              {user.firstName}
                            </span>
                            <span className='hidden font-bold sm:inline'>
                              {user.lastName}
                            </span>
                            <ChevronRight className='size-4 text-muted-foreground' />
                          </Link>
                        </Button>
                      </th>
                      <td className='text-right font-kh-interface'>
                        {standing.wins}
                      </td>
                      <td className='text-right font-kh-interface'>
                        {standing.losses}
                      </td>
                      <td className='text-right font-kh-interface'>
                        {standing.matchesPlayed}
                      </td>
                      <td>
                        <Progress
                          className='w-24'
                          value={standing.winPercentage}
                        />
                      </td>
                    </tr>
                    {standing.explanation && (
                      <tr>
                        <td
                          colSpan={2}
                          className='text-xs text-muted-foreground'>
                          {
                            loc.no.tournament.standingExplanation[
                              standing.explanation
                            ]
                          }
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className='flex items-center gap-2 rounded p-2'>
          <div className='size-2 rounded-full bg-primary' />
          <p className='text-sm text-muted-foreground'>
            {loc.no.tournament.groupInfo(tournament.config.advancementCount)}
          </p>
        </div>
      </section>

      <section className='flex flex-col gap-4 rounded-sm border bg-background p-4'>
        <h2 className='text-xl wrap-break-word sm:text-2xl'>
          {loc.no.tournament.groupMatches}
        </h2>
        <MatchList
          matches={matches}
          managed
          trackSeparators
          featuredMatchId={featuredMatch?.id}
        />
      </section>
    </div>
  )
}
