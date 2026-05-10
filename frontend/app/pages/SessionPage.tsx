import Combobox from '@/components/combobox'
import ConfirmationButton from '@/components/ConfirmationButton'
import { PageSubheader } from '@/components/PageHeader'
import SessionCard from '@/components/session/SessionCard'
import SessionForm from '@/components/session/SessionForm'
import TournamentList from '@/components/tournament/TournamentList'
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
import { Label } from '@/components/ui/label'
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
import { userToLookupItem } from '@/lib/lookup-utils'
import type { SessionWithSignups } from '@common/models/session'
import type { UserInfo } from '@common/models/user'
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

  const [userToAdd, setUserToAdd] = useState<UserInfo | null>(null)
  const [addResponse, setAddResponse] = useState<SessionResponse>('yes')

  useEffect(() => {
    setMyResponse(
      session.signups.find(s => s.user.id === loggedInUser?.id)?.response
    )
  }, [session.signups, loggedInUser?.id])

  const isAdmin = isLoggedIn && loggedInUser.role !== 'user'
  const canManageParticipants = isAdmin
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

  const addableUsers = useMemo(() => {
    if (!users) return []
    const signedUpIds = new Set(session.signups.map(s => s.user.id))
    return users.filter(u => !signedUpIds.has(u.id))
  }, [users, session.signups])

  const addableItems = useMemo(
    () => addableUsers.map(userToLookupItem),
    [addableUsers]
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

  function handleModSetResponse(userId: string, response: SessionResponse) {
    toast.promise(
      socket
        .emitWithAck('rsvp_session', {
          type: 'RsvpSessionRequest',
          session: session.id,
          user: userId,
          response,
        })
        .then(res => {
          if (!res.success) throw new Error(res.message)
          if (userId === loggedInUser?.id) setMyResponse(response)
        }),
      {
        loading: loc.no.session.participants.modRsvpToast.loading,
        success: loc.no.session.participants.modRsvpToast.success,
        error: loc.no.session.participants.modRsvpToast.error,
      }
    )
  }

  function handleRemoveSignup(userId: string) {
    toast.promise(
      socket
        .emitWithAck('remove_session_signup', {
          type: 'RemoveSessionSignupRequest',
          session: session.id,
          user: userId,
        })
        .then(res => {
          if (!res.success) throw new Error(res.message)
          if (userId === loggedInUser?.id) setMyResponse(undefined)
        }),
      {
        loading: loc.no.session.participants.removeToast.loading,
        success: loc.no.session.participants.removeToast.success,
        error: loc.no.session.participants.removeToast.error,
      }
    )
  }

  function handleAddParticipant() {
    if (!userToAdd) return
    toast.promise(
      socket
        .emitWithAck('rsvp_session', {
          type: 'RsvpSessionRequest',
          session: session.id,
          user: userToAdd.id,
          response: addResponse,
        })
        .then(res => {
          if (!res.success) throw new Error(res.message)
          setUserToAdd(null)
          if (userToAdd.id === loggedInUser?.id) setMyResponse(addResponse)
        }),
      {
        loading: loc.no.session.participants.addToast.loading,
        success: loc.no.session.participants.addToast.success,
        error: loc.no.session.participants.addToast.error,
      }
    )
  }

  const showSelfQuickRsvpHeader =
    (isUpcoming(session) || isAdmin) &&
    isLoggedIn &&
    myResponse &&
    !(canManageParticipants && myResponse)

  const hideSelfRsvpButtons =
    !isUpcoming(session) || !isLoggedIn || !!myResponse

  return (
    <div className={twMerge('flex flex-col gap-4', className)} {...rest}>
      <div className='flex justify-between'>
        <h3 className='px-2 pt-2'>
          {isUpcoming(session)
            ? loc.no.session.attendance
            : loc.no.session.attendees}
        </h3>

        <div>
          {showSelfQuickRsvpHeader && (
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
        hidden={hideSelfRsvpButtons}>
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

      {canManageParticipants && addableUsers.length > 0 && (
        <div className='border-border bg-background-secondary/80 flex flex-col gap-3 rounded-sm border p-3'>
          <h4 className='text-sm font-medium'>
            {loc.no.session.participants.addTitle}
          </h4>
          <div className='flex flex-col gap-3 md:flex-row md:items-end'>
            <div className='min-w-0 flex-1'>
              <Combobox
                disabled={disabled}
                selected={
                  userToAdd
                    ? (addableItems.find(i => i.id === userToAdd.id) ?? null)
                    : null
                }
                setSelected={v => setUserToAdd(v ?? null)}
                items={addableItems}
                CustomRow={UserRow}
                placeholder={loc.no.session.participants.addPlaceholder}
              />
            </div>
            <div className='flex flex-col gap-1'>
              <Label className='text-label-muted text-xs'>
                {loc.no.session.participants.addResponse}
              </Label>
              <Select
                disabled={disabled}
                value={addResponse}
                onValueChange={v => setAddResponse(v as SessionResponse)}>
                <SelectTrigger className='w-full md:w-[160px]'>
                  <SelectValue />
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
            </div>
            <Button
              disabled={disabled || !userToAdd}
              onClick={handleAddParticipant}>
              {loc.no.session.participants.addSubmit}
            </Button>
          </div>
        </div>
      )}

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
                .map(({ user }) => {
                  const hasSignupRow = session.signups.some(
                    su => su.user.id === user.id
                  )
                  return (
                    <div
                      key={user.id}
                      className='border-border flex flex-col gap-2 border-b px-2 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-3'>
                      <UserRow
                        item={user}
                        className='min-w-0 flex-1 py-0 first:pt-0 last:pb-0'
                      />
                      {canManageParticipants && (
                        <div className='flex shrink-0 flex-wrap items-center gap-2 sm:justify-end'>
                          <Select
                            disabled={disabled}
                            value={response}
                            onValueChange={v =>
                              handleModSetResponse(
                                user.id,
                                v as SessionResponse
                              )
                            }>
                            <SelectTrigger className='w-[160px]'>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {responses.map(({ response: r, Icon }) => (
                                <SelectItem key={r} value={r}>
                                  <Icon className='size-4' />
                                  {loc.no.session.rsvp.responses[r]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {hasSignupRow && (
                            <ConfirmationButton
                              size='sm'
                              variant='outline'
                              disabled={disabled}
                              confirmText={loc.no.common.continue}
                              onClick={() => handleRemoveSignup(user.id)}>
                              <Trash2 className='size-4' />
                              {loc.no.session.participants.remove}
                            </ConfirmationButton>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
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
              <Trash2 />
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

      <TournamentList sessionId={session.id} />

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
