import { SessionItem } from '@/components/session/SessionItem'
import { TrackItem } from '@/components/track/TrackItem'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Spinner } from '@/components/ui/spinner'
import UserItem from '@/components/user/UserItem'
import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import { DateTime } from 'luxon'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import type { SessionResponse } from '../../../backend/database/schema'
import { TimeEntryList } from './TrackPage'

export default function SessionPage() {
  const { id } = useParams()
  const { sessions, leaderboards, tracks } = useData()
  const { socket } = useConnection()
  const { loggedInUser, isLoggedIn } = useAuth()

  if (
    sessions === undefined ||
    leaderboards === undefined ||
    tracks === undefined ||
    id === undefined
  ) {
    return (
      <div className='items-center-safe justify-center-safe flex h-dvh w-full'>
        <Spinner className='size-6' />
      </div>
    )
  }

  const timeEntries = Object.values(leaderboards)
    .map(leaderboard => {
      const entries = leaderboard.entries.filter(entry => entry.session === id)
      return { id: leaderboard.id, entries }
    })
    .filter(te => te.entries.length > 0)

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

  function handleRsvp(response: SessionResponse) {
    if (!loggedInUser) return

    toast.promise(
      socket.emitWithAck('rsvp_session', {
        type: 'RsvpSessionRequest',
        session: session.id,
        user: loggedInUser.id,
        response,
      }),
      {
        ...loc.no.session.rsvp.response,
        success: loc.no.session.rsvp.response.success(response),
      }
    )
  }

  return (
    <div className='flex flex-col gap-6'>
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
            <BreadcrumbPage>{session.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <SessionItem className='px-2' variant='card' session={session} />

      {isUpcoming && isLoggedIn && (
        <ButtonGroup className='w-full'>
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
        </ButtonGroup>
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

      {timeEntries.map(({ id: trackId, entries }) => (
        <div
          key={trackId}
          className='bg-background gap-2 rounded-sm border p-2'>
          <TrackItem track={tracks[trackId]} variant='row' />
          <TimeEntryList key={id} entries={entries} />
        </div>
      ))}
    </div>
  )
}
