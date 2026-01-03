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
            <BreadcrumbPage>{loc.no.tournament.new}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        title={loc.no.tournament.new}
        description={loc.no.tournament.description}
        icon='TrophyIcon'
      />

      <TournamentForm id='createTournamentForm' />

      <div className='flex justify-end gap-2'>
        <Button variant='outline' size='lg' className='w-fit'>
          {loc.no.common.cancel}
        </Button>
        <Button
          type='submit'
          form='createTournamentForm'
          size='lg'
          className='w-fit'>
          {loc.no.common.continue}
        </Button>
      </div>
    </div>
  )
}
