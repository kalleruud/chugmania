import ConfirmationButton from '@/components/ConfirmationButton'
import { PageSubheader } from '@/components/PageHeader'
import SessionCard from '@/components/session/SessionCard'
import SessionForm from '@/components/session/SessionForm'
import TrackLeaderboard from '@/components/track/TrackLeaderboard'
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
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Empty } from '@/components/ui/empty'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import UserRow from '@/components/user/UserRow'
import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import type { SessionWithSignups } from '@common/models/session'
import { isUpcoming } from '@common/utils/date'
import accumulateSignups from '@common/utils/signupAccumulator'
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import { PencilIcon, Trash2 } from 'lucide-react'
import { useMemo, useState, type ComponentProps } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'
import type { SessionResponse } from '../../../backend/database/schema'
import { SubscribeButton } from './SessionsPage'

function Signup({
  session,
  disabled,
  className,
  ...rest
}: Readonly<
  { session: SessionWithSignups; disabled?: boolean } & ComponentProps<'div'>
>) {
  const { socket } = useConnection()
  const { loggedInUser, isLoggedIn } = useAuth()
  const { timeEntries, matches, users, isLoadingData } = useData()

  const [myResponse, setMyResponse] = useState<SessionResponse | undefined>(
    session.signups.find(s => s.user.id === loggedInUser?.id)?.response
  )

  const isAdmin = isLoggedIn && loggedInUser.role !== 'user'
  const responses: SessionResponse[] = ['yes', 'maybe', 'no']

  const accumulatedSignups = useMemo(
    () =>
      accumulateSignups(
        session.id,
        session.signups,
        timeEntries ?? [],
        matches ?? []
      ),
    [session.id, session.signups, timeEntries, matches]
  )

  if (isLoadingData)
    return (
      <div className='items-center-safe justify-center-safe flex h-dvh w-full'>
        <Spinner className='size-6' />
      </div>
    )

  function handleRsvp(response: SessionResponse) {
    if (!isLoggedIn) return
    toast.promise(
      socket
        .emitWithAck('rsvp_session', {
          type: 'RsvpSessionRequest',
          session: session.id,
          user: loggedInUser.id,
          response,
        })
        .then(res => {
          if (res.success) setMyResponse(response)
          else throw new Error(res.message)
        }),
      {
        loading: loc.no.session.rsvp.response.loading,
        success: loc.no.session.rsvp.response.success(response),
        error: loc.no.session.rsvp.response.error,
      }
    )
  }

  return (
    <div className={twMerge('flex flex-col gap-4', className)} {...rest}>
      <div className='flex justify-between'>
        <h3 className='px-2 pt-2'>
          {isUpcoming(session)
            ? loc.no.session.attendance
            : loc.no.session.attendees}
        </h3>

        <div className='flex items-center gap-1'>
          {(isUpcoming(session) || isAdmin) && isLoggedIn && myResponse && (
            <Select
              disabled={disabled}
              value={myResponse}
              onValueChange={handleRsvp}>
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
          )}

          {isUpcoming(session) && isLoggedIn && !myResponse && (
            <Button
              size='sm'
              onClick={() => handleRsvp('yes')}
              disabled={disabled}>
              <CheckCircleIcon />
              {loc.no.session.rsvp.responses.yes}
            </Button>
          )}
        </div>
      </div>

      {accumulatedSignups.length === 0 && (
        <Empty className='border-input text-muted-foreground border text-sm'>
          {loc.no.common.noItems}
        </Empty>
      )}

      {responses.map(response => {
        const responses = accumulatedSignups.filter(
          s => s.response === response
        )
        if (responses.length === 0) return undefined
        return (
          <div key={response} className='flex flex-col'>
            <PageSubheader
              title={loc.no.session.rsvp.responses[response]}
              description={responses.length.toString()}
            />
            <div className='bg-background-secondary rounded-sm'>
              {accumulatedSignups.map(signup => (
                <UserRow
                  key={signup.user}
                  item={users.find(u => u.id === signup.user)!}
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
  const { socket } = useConnection()
  const { sessions, tracks, isLoadingData } = useData()
  const { loggedInUser, isLoggedIn, isLoading } = useAuth()
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  const isAdmin = isLoggedIn && loggedInUser.role === 'admin'
  const isModerator = isLoggedIn && loggedInUser.role === 'moderator'
  const canEdit = isAdmin || isModerator

  const handleDeleteSession = async (sessionId: string) => {
    toast.promise(
      socket
        .emitWithAck('delete_session', {
          type: 'DeleteSessionRequest',
          id: sessionId,
        })
        .then(r => {
          if (!r.success) throw new Error(r.message)
          return r
        }),
      {
        loading: 'Sletter session...',
        success: 'Sesjonen ble slettet',
        error: (err: Error) => `Sletting feilet: ${err.message}`,
      }
    )
  }

  if (isLoadingData) {
    return (
      <div className='items-center-safe justify-center-safe flex h-dvh w-full'>
        <Spinner className='size-6' />
      </div>
    )
  }

  const session = sessions.find(s => s.id === id)
  if (!session)
    throw new Error(loc.no.error.messages.not_in_db('sessions/' + id))

  const isCancelled = session?.status === 'cancelled'

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

      <SessionCard className='px-2' session={session} />

      <div className='flex items-center gap-1'>
        <SubscribeButton className='flex-1' />
        {canEdit && (
          <>
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogTrigger asChild>
                <Button variant='outline'>
                  <PencilIcon className='size-4' />
                  {loc.no.session.edit}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{loc.no.session.edit}</DialogTitle>
                </DialogHeader>
                <SessionForm
                  id='editForm'
                  variant='edit'
                  session={session}
                  onSubmitResponse={success => {
                    if (success) setEditDialogOpen(false)
                  }}
                />
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant='outline' disabled={isLoading}>
                      {loc.no.common.cancel}
                    </Button>
                  </DialogClose>
                  <ConfirmationButton form='editForm' disabled={isLoading}>
                    {loc.no.common.continue}
                  </ConfirmationButton>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <ConfirmationButton
              variant='destructive'
              onClick={() => handleDeleteSession(session.id)}
              disabled={isLoading}>
              <Trash2 className='mr-2 size-4' />
              {loc.no.common.delete}
            </ConfirmationButton>
          </>
        )}
      </div>

      <Signup
        className='bg-background rounded-sm border p-2'
        disabled={isCancelled}
        session={session}
      />

      {tracks.map(track => (
        <TrackLeaderboard
          key={track.id}
          track={track}
          session={session.id}
          highlight={e => isLoggedIn && loggedInUser.id === e.id}
          filter='all'
        />
      ))}
    </div>
  )
}
