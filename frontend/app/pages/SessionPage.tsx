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
import UserItem from '@/components/user/UserItem'
import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import { CalendarIcon, MapPinIcon } from 'lucide-react'
import { DateTime } from 'luxon'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '../../components/PageHeader'

export default function SessionPage() {
  const { id } = useParams()
  const { sessions } = useData()
  const { socket } = useConnection()
  const { loggedInUser } = useAuth()

  if (sessions === undefined) {
    return (
      <div className='items-center-safe justify-center-safe flex h-dvh w-full'>
        <Spinner className='size-6' />
      </div>
    )
  }

  if (id === undefined || !(id in sessions)) {
    throw new Error(loc.no.error.messages.not_in_db(`session/${id}`))
  }

  const session = sessions[id]
  const date = DateTime.fromJSDate(new Date(session.date)).setLocale('nb')
  const isUpcoming = date > DateTime.now()

  const mySignup = session.signups.find(s => s.user.id === loggedInUser?.id)
  const attendees = session.signups.filter(s => s.response === 'yes')
  const maybe = session.signups.filter(s => s.response === 'maybe')
  const declined = session.signups.filter(s => s.response === 'no')

  function handleRsvp(response: 'yes' | 'maybe' | 'no') {
    if (!loggedInUser) return

    socket
      .emitWithAck('rsvp_session', {
        type: 'RsvpSessionRequest',
        session: session.id,
        user: loggedInUser.id,
        response,
      })
      .then(r => {
        if (!r.success) toast.error(r.message)
        else toast.success(loc.no.session.rsvp.change)
      })
  }

  function handleDownloadIcs() {
    window.open(`/api/sessions/${session.id}/calendar.ics`, '_blank')
  }

  return (
    <div className='p-safe-or-2 flex flex-col gap-6'>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink to='/'>{loc.no.home}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink to='/sessions'>
              {loc.no.session.title}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{session.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className='flex flex-col gap-4'>
        <PageHeader title={session.name} icon='CalendarIcon' />

        <div className='bg-background-secondary flex flex-col gap-4 rounded-md p-4'>
          <div className='flex items-center gap-2'>
            <CalendarIcon className='text-primary size-5' />
            <span className='capitalize'>
              {date.toFormat('cccc d. MMMM yyyy HH:mm')}
            </span>
          </div>
          {session.location && (
            <div className='flex items-center gap-2'>
              <MapPinIcon className='text-primary size-5' />
              <span>{session.location}</span>
            </div>
          )}
          {session.description && (
            <p className='text-muted-foreground whitespace-pre-wrap text-sm'>
              {session.description}
            </p>
          )}

          <div className='mt-2 flex gap-2'>
            <Button variant='outline' size='sm' onClick={handleDownloadIcs}>
              {loc.no.session.calendar.download}
            </Button>
          </div>
        </div>
      </div>

      {isUpcoming && loggedInUser && (
        <div className='flex flex-col gap-2'>
          <h3 className='text-muted-foreground px-1 text-sm font-medium uppercase'>
            {loc.no.session.rsvp.title}
          </h3>
          <div className='bg-background-secondary flex gap-2 rounded-md p-4'>
            <Button
              variant={mySignup?.response === 'yes' ? 'default' : 'outline'}
              className='flex-1'
              onClick={() => handleRsvp('yes')}>
              {loc.no.session.rsvp.yes}
            </Button>
            <Button
              variant={mySignup?.response === 'maybe' ? 'default' : 'outline'}
              className='flex-1'
              onClick={() => handleRsvp('maybe')}>
              {loc.no.session.rsvp.maybe}
            </Button>
            <Button
              variant={mySignup?.response === 'no' ? 'default' : 'outline'}
              className='flex-1'
              onClick={() => handleRsvp('no')}>
              {loc.no.session.rsvp.no}
            </Button>
          </div>
        </div>
      )}

      {(attendees.length > 0 || maybe.length > 0 || declined.length > 0) && (
        <div className='flex flex-col gap-4'>
          {attendees.length > 0 && (
            <div>
              <h3 className='text-muted-foreground mb-2 px-1 text-sm font-medium uppercase'>
                {loc.no.session.rsvp.yes} ({attendees.length})
              </h3>
              <div className='bg-background-secondary rounded-sm'>
                {attendees.map(signup => (
                  <UserItem
                    key={signup.user.id}
                    user={signup.user}
                    variant='row'
                    className='py-3 first:pt-4 last:pb-4'
                  />
                ))}
              </div>
            </div>
          )}

          {maybe.length > 0 && (
            <div>
              <h3 className='text-muted-foreground mb-2 px-1 text-sm font-medium uppercase'>
                {loc.no.session.rsvp.maybe} ({maybe.length})
              </h3>
              <div className='bg-background-secondary rounded-sm'>
                {maybe.map(signup => (
                  <UserItem
                    key={signup.user.id}
                    user={signup.user}
                    variant='row'
                    className='py-3 first:pt-4 last:pb-4'
                  />
                ))}
              </div>
            </div>
          )}

          {declined.length > 0 && (
            <div>
              <h3 className='text-muted-foreground mb-2 px-1 text-sm font-medium uppercase'>
                {loc.no.session.rsvp.no} ({declined.length})
              </h3>
              <div className='bg-background-secondary rounded-sm'>
                {declined.map(signup => (
                  <UserItem
                    key={signup.user.id}
                    user={signup.user}
                    variant='row'
                    className='py-3 first:pt-4 last:pb-4'
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {session.lapTimes.length > 0 && (
        <div>
          <h3 className='text-muted-foreground mb-2 px-1 text-sm font-medium uppercase'>
            Rundetider
          </h3>
          <div className='bg-background-secondary rounded-sm'>
            {/* TODO: Display lap times. For now just a count or simple list */}
            <p className='text-muted-foreground p-4 text-sm'>
              {session.lapTimes.length} rundetider registrert.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
