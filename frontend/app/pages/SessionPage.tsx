import ConfirmationButton from '@/components/ConfirmationButton'
import { PageSubheader } from '@/components/PageHeader'
import SessionCard from '@/components/session/SessionCard'
import SessionForm from '@/components/session/SessionForm'
import TournamentCard from '@/components/tournament/TournamentCard'
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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import UserRow from '@/components/user/UserRow'
import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import type { SessionWithSignups } from '@common/models/session'
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
  const { sessions, tracks, tournaments, isLoadingData } = useData()
  const { loggedInUser, isLoggedIn, isLoading } = useAuth()
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [createTournamentOpen, setCreateTournamentOpen] = useState(false)
  const [tournamentName, setTournamentName] = useState('')
  const [tournamentDescription, setTournamentDescription] = useState('')
  const [tournamentGroupsCount, setTournamentGroupsCount] = useState(4)
  const [tournamentAdvancementCount, setTournamentAdvancementCount] =
    useState(1)
  const [tournamentEliminationType, setTournamentEliminationType] = useState<
    'single' | 'double'
  >('single')

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
  const sessionTournaments = tournaments.filter(t => t.session === session.id)

  const handleCreateTournament = () => {
    toast.promise(
      socket
        .emitWithAck('create_tournament', {
          type: 'CreateTournamentRequest',
          session: session.id,
          name: tournamentName.trim(),
          description: tournamentDescription.trim() || null,
          groupsCount: tournamentGroupsCount,
          advancementCount: tournamentAdvancementCount,
          eliminationType: tournamentEliminationType,
        })
        .then(r => {
          if (!r.success) throw new Error(r.message)
          setCreateTournamentOpen(false)
          setTournamentName('')
          setTournamentDescription('')
        }),
      {
        loading: 'Oppretter turnering...',
        success: 'Turnering opprettet',
        error: (e: Error) => `Oppretting feilet: ${e.message}`,
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
            <Dialog
              open={createTournamentOpen}
              onOpenChange={setCreateTournamentOpen}>
              <DialogTrigger asChild>
                <Button variant='outline' disabled={isCancelled}>
                  + Tournament
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create tournament</DialogTitle>
                </DialogHeader>
                <div className='grid gap-3'>
                  <div className='grid gap-2'>
                    <label className='text-sm font-semibold'>Name</label>
                    <Input
                      value={tournamentName}
                      onChange={e => setTournamentName(e.target.value)}
                      placeholder='Tournament name'
                    />
                  </div>
                  <div className='grid gap-2'>
                    <label className='text-sm font-semibold'>Description</label>
                    <Textarea
                      value={tournamentDescription}
                      onChange={e => setTournamentDescription(e.target.value)}
                      placeholder='Optional description'
                    />
                  </div>
                  <div className='grid grid-cols-2 gap-3'>
                    <div className='grid gap-2'>
                      <label className='text-sm font-semibold'>Groups</label>
                      <Input
                        type='number'
                        min={1}
                        value={tournamentGroupsCount}
                        onChange={e =>
                          setTournamentGroupsCount(
                            Number.parseInt(e.target.value || '0')
                          )
                        }
                      />
                    </div>
                    <div className='grid gap-2'>
                      <label className='text-sm font-semibold'>
                        Advancers / group
                      </label>
                      <Input
                        type='number'
                        min={1}
                        value={tournamentAdvancementCount}
                        onChange={e =>
                          setTournamentAdvancementCount(
                            Number.parseInt(e.target.value || '0')
                          )
                        }
                      />
                    </div>
                  </div>
                  <div className='grid gap-2'>
                    <label className='text-sm font-semibold'>
                      Elimination type
                    </label>
                    <Select
                      value={tournamentEliminationType}
                      onValueChange={v =>
                        setTournamentEliminationType(v as 'single' | 'double')
                      }>
                      <SelectTrigger className='w-full'>
                        <SelectValue placeholder='Elimination type' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='single'>
                          Single elimination
                        </SelectItem>
                        <SelectItem value='double'>
                          Double elimination
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant='outline' disabled={isLoading}>
                      {loc.no.common.cancel}
                    </Button>
                  </DialogClose>
                  <Button
                    onClick={handleCreateTournament}
                    disabled={isLoading || tournamentName.trim().length === 0}>
                    {loc.no.common.save}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

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

      <div className='grid gap-2'>
        <PageSubheader
          title='Tournaments'
          description={`${sessionTournaments.length}`}
        />
        {sessionTournaments.length === 0 ? (
          <Empty className='border-input text-muted-foreground border text-sm'>
            {loc.no.common.noItems}
          </Empty>
        ) : (
          <div className='grid gap-4'>
            {sessionTournaments.map(t => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
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
