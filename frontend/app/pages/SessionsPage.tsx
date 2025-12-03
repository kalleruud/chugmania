import SessionForm from '@/components/session/SessionForm'
import SessionsList from '@/components/session/SessionsList'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import loc from '@/lib/locales'
import { CalendarIcon } from '@heroicons/react/24/solid'
import { ChevronDown, PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { PageHeader } from '../../components/PageHeader'

export default function SessionsPage() {
  const [showPreviousSessions, setShowPreviousSessions] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const { loggedInUser, isLoggedIn } = useAuth()

  const isAdmin = isLoggedIn && loggedInUser.role === 'admin'
  const isModerator = isLoggedIn && loggedInUser.role === 'moderator'
  const canCreate = isAdmin || isModerator

  return (
    <div className='p-safe-or-2 flex flex-col gap-2'>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink to='/'>{loc.no.common.home}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{loc.no.session.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        title={loc.no.session.title}
        description={loc.no.session.description}
        icon='CalendarIcon'
      />

      <div className='flex gap-2'>
        <SubscribeButton className={twMerge(!canCreate && 'w-full')} />
        {canCreate && (
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant='outline'>
                <PlusIcon className='size-4' />
                {loc.no.session.create}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{loc.no.session.create}</DialogTitle>
              </DialogHeader>
              <SessionForm
                variant='create'
                onSubmitResponse={(success: boolean) => {
                  if (success) setCreateDialogOpen(false)
                }}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <SessionsList header={loc.no.session.upcoming} upcoming />
      {showPreviousSessions ? (
        <SessionsList header={loc.no.session.past} past />
      ) : (
        <div>
          <Button variant='ghost' onClick={() => setShowPreviousSessions(true)}>
            {loc.no.session.past}
            <ChevronDown />
          </Button>
        </div>
      )}
    </div>
  )
}

export function SubscribeButton({
  className,
  variant,
  ...rest
}: Readonly<Parameters<typeof Button>[0]>) {
  const subscribe = () => {
    const url =
      `${globalThis.location.origin}/api/sessions/calendar.ics`.replace(
        /^https?:\/\//,
        'webcal://'
      )
    window.open(url)
  }

  return (
    <Button
      className={twMerge('flex-1', className)}
      onClick={subscribe}
      {...rest}>
      <CalendarIcon className='size-4' />
      {loc.no.session.calendar.subscribe}
    </Button>
  )
}
