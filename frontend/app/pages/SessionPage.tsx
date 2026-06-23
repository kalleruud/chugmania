import ConfirmationButton from '@/components/ConfirmationButton'
import { PageSubheader } from '@/components/PageHeader'
import SessionCard from '@/components/session/SessionCard'
import SessionForm from '@/components/session/SessionForm'
import TournamentPanel from '@/components/tournament/TournamentPanel'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import UserRow from '@/components/user/UserRow'
import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import type { SessionWithSignups } from '@common/models/session'
import type { TournamentDetails } from '@common/models/tournament'
import { isUpcoming } from '@common/utils/date'
import accumulateSignups from '@common/utils/signupAccumulator'
import {
  CircleCheck,
  CircleQuestionMark,
  CircleX,
  PencilIcon,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ComponentProps } from 'react'
import { Link, useParams } from 'react-router-dom'
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
  const { timeEntries, matches, users, rankings, isLoadingData } = useData()

  const [myResponse, setMyResponse] = useState<SessionResponse | undefined>(
    session.signups.find(s => s.user.id === loggedInUser?.id)?.response
  )

  const isAdmin = isLoggedIn && loggedInUser.role !== 'user'
  const responses: { response: SessionResponse; Icon: LucideIcon }[] = [
    { response: 'yes', Icon: CircleCheck },
    { response: 'maybe', Icon: CircleQuestionMark },
    { response: 'no', Icon: CircleX },
  ]

  const accumulatedSignups = useMemo(
    () =>
      accumulateSignups(session, timeEntries ?? [], matches ?? [])
        .map(s => {
          const user = users?.find(u => u.id === s.user)
          if (!user) return undefined
          return {
            user,
            response: s.response,
          }
        })
        .filter(s => s !== undefined)
        .toSorted((a, b) => {
          const rankA =
            rankings?.find(r => r.user === a.user.id)?.ranking ??
            Number.MAX_SAFE_INTEGER
          const rankB =
            rankings?.find(r => r.user === b.user.id)?.ranking ??
            Number.MAX_SAFE_INTEGER
          return rankA - rankB
        }),
    [session, timeEntries, matches, users, rankings]
  )

  if (isLoadingData)
    return (
      <div className='items-center-safe justify-center-safe border-border flex h-32 w-full rounded-sm border'>
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

        <div>
          {(isUpcoming(session) || isAdmin) && isLoggedIn && myResponse && (
            <Select
              disabled={disabled}
              value={myResponse}
              onValueChange={handleRsvp}>
              <SelectTrigger className='w-[180px]'>
                <SelectValue placeholder={loc.no.session.rsvp.change} />
              </SelectTrigger>
              <SelectContent>
                {responses.map(({ response, Icon }) => (
                  <SelectItem key={response} value={response}>
                    <Icon className='size-4' />
                    {loc.no.session.rsvp.responses[response]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div
        className='flex items-center justify-center gap-2'
        hidden={!isUpcoming(session) || !isLoggedIn || !!myResponse}>
        {responses.map(({ response, Icon }) => (
          <Button
            key={response}
            size='sm'
            onClick={() => handleRsvp(response)}
            disabled={disabled}>
            <Icon className='size-4' />
            {loc.no.session.rsvp.responses[response]}
          </Button>
        ))}
      </div>

      {accumulatedSignups.length === 0 && (
        <Empty className='border-input text-muted-foreground border text-sm'>
          {loc.no.common.noItems}
        </Empty>
      )}

      {responses.map(({ response }) => {
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
              {accumulatedSignups
                .filter(s => s.response === response)
                .map(({ user }) => (
                  <UserRow
                    key={user.id}
                    item={user}
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
  const [tournamentDetails, setTournamentDetails] = useState<
    TournamentDetails | null | undefined
  >(undefined)

  const isAdmin = isLoggedIn && loggedInUser.role === 'admin'
  const isModerator = isLoggedIn && loggedInUser.role === 'moderator'
  const canEdit = isAdmin || isModerator

  useEffect(() => {
    if (!id) return
    setTournamentDetails(undefined)
    socket
      .emitWithAck('get_tournament_details', {
        type: 'GetTournamentDetailsRequest',
        sessionId: id,
      })
      .then(
        (res: {
          success: boolean
          details?: TournamentDetails | null
          message?: string
        }) => {
          if (res.success && 'details' in res) {
            setTournamentDetails(res.details ?? null)
          } else {
            setTournamentDetails(null)
          }
        }
      )
  }, [id, socket])

  useEffect(() => {
    if (!id) return
    const h = (p: { sessionId: string; details: TournamentDetails | null }) => {
      if (p.sessionId === id) setTournamentDetails(p.details)
    }
    socket.on('session_tournament', h)
    return () => {
      socket.off('session_tournament', h)
    }
  }, [id, socket])

  const session = useMemo(
    () => (id && sessions ? sessions.find(s => s.id === id) : undefined),
    [sessions, id]
  )

  const signupSummary = useMemo(() => {
    if (!session) return { yes: 0, maybe: 0, no: 0 }
    let yes = 0
    let maybe = 0
    let no = 0
    for (const s of session.signups) {
      if (s.response === 'yes') yes++
      else if (s.response === 'maybe') maybe++
      else no++
    }
    return { yes, maybe, no }
  }, [session])

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

  if (!session)
    throw new Error(loc.no.error.messages.not_in_db('sessions/' + id))

  const isCancelled = session?.status === 'cancelled'

  async function handleDeleteTournament() {
    toast.promise(
      socket
        .emitWithAck('delete_tournament', {
          type: 'DeleteTournamentRequest',
          sessionId: session.id,
        })
        .then(r => {
          if (!r.success) throw new Error(r.message)
        }),
      {
        loading: loc.no.tournament.toast.deleteLoading,
        success: loc.no.tournament.toast.deleted,
        error: (e: Error) => e.message,
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
              <Trash2 />
              {loc.no.common.delete}
            </ConfirmationButton>
          </>
        )}
      </div>

      <Tabs defaultValue='session' className='flex flex-col gap-4'>
        <TabsList className='bg-background-secondary w-full max-w-md'>
          <TabsTrigger value='session'>
            {loc.no.tournament.tabSession}
          </TabsTrigger>
          <TabsTrigger value='participants'>
            {loc.no.tournament.tabParticipants}
          </TabsTrigger>
          <TabsTrigger value='tournament'>
            {loc.no.tournament.tabTournament}
          </TabsTrigger>
        </TabsList>
        <TabsContent value='session' className='flex flex-col gap-4'>
          {tracks.map(track => (
            <TrackLeaderboard
              key={track.id}
              track={track}
              session={session.id}
              omitTournamentMatches
              highlight={e => isLoggedIn && loggedInUser.id === e.id}
              filter='all'
            />
          ))}
        </TabsContent>
        <TabsContent value='participants' className='flex flex-col gap-4'>
          <p className='text-muted-foreground text-sm'>
            {loc.no.session.rsvp.responses.yes}: {signupSummary.yes} ·{' '}
            {loc.no.session.rsvp.responses.maybe}: {signupSummary.maybe} ·{' '}
            {loc.no.session.rsvp.responses.no}: {signupSummary.no}
          </p>
          <Signup
            className='bg-background rounded-sm border p-2'
            disabled={isCancelled}
            session={session}
          />
        </TabsContent>
        <TabsContent value='tournament' className='flex flex-col gap-4'>
          {tournamentDetails === undefined ? (
            <Spinner className='size-6' />
          ) : tournamentDetails ? (
            <>
              {canEdit && (
                <div className='flex justify-end'>
                  <ConfirmationButton
                    variant='destructive'
                    onClick={handleDeleteTournament}
                    disabled={isLoading}>
                    {loc.no.tournament.delete}
                  </ConfirmationButton>
                </div>
              )}
              <TournamentPanel details={tournamentDetails} />
            </>
          ) : canEdit ? (
            <div className='flex flex-col items-start gap-2'>
              <p className='text-muted-foreground text-sm'>
                {loc.no.common.noItems}
              </p>
              <Button variant='default' asChild>
                <Link to={`/sessions/${session.id}/tournament/new`}>
                  {loc.no.tournament.create}
                </Link>
              </Button>
            </div>
          ) : (
            <p className='text-muted-foreground text-sm'>
              {loc.no.common.noItems}
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
