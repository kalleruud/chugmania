import { PageHeader } from '@/components/PageHeader'
import TournamentForm from '@/components/tournament/TournamentForm'
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
import loc from '@/lib/locales'

export default function CreateTournamentPage() {
  const { isLoading, loggedInUser } = useAuth()

  if (isLoading) {
    return (
      <div className='h-dvh-safe flex w-full items-center justify-center'>
        <Spinner />
      </div>
    )
  }

  // Check admin access
  if (loggedInUser?.role !== 'admin') {
    throw new Error(loc.no.error.messages.insufficient_permissions)
  }

  return (
    <div className='flex flex-col gap-4'>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink to='/'>{loc.no.common.home}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{loc.no.tournament.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        title={loc.no.tournament.title}
        description={loc.no.tournament.description}
        icon='TrophyIcon'
      />

      <TournamentForm id='createTournamentForm' />

      <Button type='submit' form='createTournamentForm'>
        {loc.no.common.continue}
      </Button>
    </div>
  )
}
