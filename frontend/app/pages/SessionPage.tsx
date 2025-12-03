import { PageSubheader } from '@/components/PageHeader'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import UserItem from '@/components/user/UserItem'
import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import { DateTime } from 'luxon'
import { useState, type ComponentProps } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'
import type { SessionResponse } from '../../../backend/database/schema'
import type { SessionWithSignups } from '../../../common/models/session'
import { SubscribeButton } from './SessionsPage'
import { TimeEntryList } from './TrackPage'

function Signup({
  session,
  className,
  ...rest
}: Readonly<{ session: SessionWithSignups } & ComponentProps<'div'>>) {
  const { socket } = useConnection()
  const { loggedInUser, isLoggedIn } = useAuth()
  const [myResponse, setMyResponse] = useState<SessionResponse | undefined>(
    session.signups.find(s => s.user.id === loggedInUser?.id)?.response
  )

  const date = DateTime.fromJSDate(new Date(session.date)).setLocale('nb')
  const isUpcoming = date > DateTime.now()

  const responses: SessionResponse[] = ['yes', 'maybe', 'no']

  function handleRsvp(response: SessionResponse) {
    if (!isLoggedIn) return
    socket
      .emitWithAck('rsvp_session', {
        type: 'RsvpSessionRequest',
        session: session.id,
        user: loggedInUser.id,
        response,
      })
      .then(res => {
        if (res.success) setMyResponse(response)
        else toast.error(res.message)
      })
  }

  return (
    <div className={twMerge('flex flex-col gap-4', className)} {...rest}>
      <div className='flex justify-between'>
        <h3 className='px-2 pt-2'>
          {isUpcoming ? loc.no.session.attendance : loc.no.session.attendees}
        </h3>

        <div className='flex items-center gap-1'>
          {isUpcoming &&
            isLoggedIn &&
            (myResponse ? (
              <Select value={myResponse} onValueChange={handleRsvp}>
                <SelectTrigger className='w-[180px]'>
                  <SelectValue placeholder={loc.no.session.rsvp.change} />
                </SelectTrigger>
                <SelectContent>
                  {responses.map(response => (
                    <SelectItem key={response} value={response}>
                      {loc.no.session.rsvp.responses[response]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Button onClick={() => handleRsvp('yes')}>
                <CheckCircleIcon />
                {loc.no.session.rsvp.responses.yes}
              </Button>
            ))}
        </div>
      </div>

      {responses.map(response => {
        const responses = session.signups.filter(s => s.response === response)
        if (responses.length === 0) return undefined
        return (
          <div key={response} className='flex flex-col'>
            <PageSubheader
              title={loc.no.session.rsvp.responses[response]}
              description={responses.length.toString()}
            />
            <div className='bg-background-secondary rounded-sm'>
              {responses.map(signup => (
                <UserItem
                  key={signup.user.id}
                  user={signup.user}
                  variant='row'
                  className='py-3 first:pt-4 last:pb-4'
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function SessionPage() {
  const { id } = useParams()
  const { sessions, leaderboards, tracks } = useData()
  const { loggedInUser, isLoggedIn } = useAuth()

  if (
    sessions === undefined ||
    leaderboards === undefined ||
    tracks === undefined ||
    id === undefined ||
    !(id in sessions)
  ) {
    return (
      <div className='items-center-safe justify-center-safe flex h-dvh w-full'>
        <Spinner className='size-6' />
      </div>
    )
  }

  const session = sessions[id]

  const timeEntries = Object.values(leaderboards)
    .map(leaderboard => {
      const entries = leaderboard.entries.filter(entry => entry.session === id)
      return { id: leaderboard.id, entries }
    })
    .filter(te => te.entries.length > 0)

  if (id === undefined || !(id in sessions)) {
    throw new Error(loc.no.error.messages.not_in_db(`session/${id}`))
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

      <SubscribeButton />

      <Signup
        className='bg-background rounded-sm border p-2'
        session={session}
      />

      {timeEntries.map(({ id: trackId, entries }) => (
        <div key={trackId} className='bg-background rounded-sm border p-2'>
          <TrackItem track={tracks[trackId]} variant='row' />
          <TimeEntryList
            key={id}
            entries={entries}
            highlight={e => isLoggedIn && loggedInUser.id === e.user}
          />
        </div>
      ))}
    </div>
  )
}
