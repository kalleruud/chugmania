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
import { useMemo, useState, type ComponentProps } from 'react'
import { useParams } from 'react-router'
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
  const responseOptions: { response: SessionResponse; Icon: LucideIcon }[] = [
    { response: 'yes', Icon: CircleCheck },
    { response: 'maybe', Icon: CircleQuestionMark },
    { response: 'no', Icon: CircleX },
  ]
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [selectedPickerUser, setSelectedPickerUser] = useState<
    ReturnType<typeof userToLookupItem> | null | undefined
  >(null)
  const [selectedResponse, setSelectedResponse] =
    useState<SessionResponse>('yes')

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
  const signedUpUserIds = useMemo(
    () => new Set(session.signups.map(s => s.user.id)),
    [session.signups]
  )
  const availableUsers = useMemo(
    () =>
      users
        ?.filter(user => !signedUpUserIds.has(user.id))
        .toSorted((a, b) =>
          `${a.firstName} ${a.lastName ?? ''}`.localeCompare(
            `${b.firstName} ${b.lastName ?? ''}`
          )
        ) ?? [],
    [users, signedUpUserIds]
  )
  const selectedUsers = useMemo(
    () => availableUsers.filter(user => selectedUserIds.includes(user.id)),
    [availableUsers, selectedUserIds]
  )
  const selectableUsers = useMemo(
    () => availableUsers.filter(user => !selectedUserIds.includes(user.id)),
    [availableUsers, selectedUserIds]
  )

  if (isLoadingData)
    return (
      <div className='flex h-32 w-full items-center-safe justify-center-safe rounded-sm border border-border'>
        <Spinner className='size-6' />
      </div>
    )

  async function updateSignup(response: SessionResponse, user: UserInfo) {
    const res = await socket.emitWithAck('rsvp_session', {
      type: 'RsvpSessionRequest',
      session: session.id,
      user: user.id,
      response,
    })

    if (!res.success) throw new Error(res.message)
  }

  function handleRsvp(response: SessionResponse, user?: UserInfo) {
    if (!isLoggedIn) return
    toast.promise(
      updateSignup(response, user ?? loggedInUser).then(() => {
        if (!user || user.id === loggedInUser.id) setMyResponse(response)
      }),
      {
        loading: loc.no.session.rsvp.response.loading,
        success: loc.no.session.rsvp.response.success(response),
        error: loc.no.session.rsvp.response.error,
      }
    )
  }

  function handleSelectUser(user: UserInfo | null | undefined) {
    setSelectedPickerUser(null)
    if (!user) return
    setSelectedUserIds(current =>
      current.includes(user.id) ? current : [...current, user.id]
    )
  }

  function removeSelectedUser(userId: string) {
    setSelectedUserIds(current =>
      current.filter(selectedUserId => selectedUserId !== userId)
    )
  }

  function handleAddParticipants() {
    if (selectedUsers.length === 0) return

    toast.promise(
      Promise.all(
        selectedUsers.map(user => updateSignup(selectedResponse, user))
      ).then(() => {
        if (selectedUserIds.includes(loggedInUser.id)) {
          setMyResponse(selectedResponse)
        }
        setSelectedUserIds([])
        setAddDialogOpen(false)
      }),
      loc.no.session.rsvp.manage.addRequest(selectedUsers.length)
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
              <SelectTrigger className='w-[160px]'>
                <SelectValue placeholder={loc.no.session.rsvp.change} />
              </SelectTrigger>
              <SelectContent>
                {responseOptions.map(({ response, Icon }) => (
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
        {responseOptions.map(({ response, Icon }) => (
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

      {isAdmin && (
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button type='button' variant='outline' disabled={disabled}>
              <CircleCheck className='size-4' />
              {loc.no.session.rsvp.manage.add}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{loc.no.session.rsvp.manage.title}</DialogTitle>
            </DialogHeader>
            <div className='flex flex-col gap-4'>
              <Select
                value={selectedResponse}
                onValueChange={value =>
                  setSelectedResponse(value as SessionResponse)
                }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {responseOptions.map(({ response, Icon }) => (
                    <SelectItem key={response} value={response}>
                      <Icon className='size-4' />
                      {loc.no.session.rsvp.responses[response]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Combobox
                placeholder={loc.no.session.rsvp.manage.userPlaceholder}
                emptyLabel={loc.no.common.noItems ?? undefined}
                items={selectableUsers}
                selected={selectedPickerUser}
                setSelected={handleSelectUser}
                CustomRow={props => <UserRow {...props} hideLink hideRanking />}
              />

              {availableUsers.length === 0 && (
                <Empty className='border border-input text-sm text-muted-foreground'>
                  {loc.no.common.noItems}
                </Empty>
              )}

              {selectedUsers.length > 0 && (
                <div className='max-h-80 overflow-y-auto rounded-sm bg-background-secondary'>
                  {selectedUsers.map(user => (
                    <div
                      key={user.id}
                      className='flex items-center gap-2 border-b border-border/60 p-2 last:border-b-0'>
                      <UserRow
                        item={user}
                        hideLink
                        hideRanking
                        className='flex-1 py-2'
                      />
                      <Button
                        type='button'
                        size='icon'
                        variant='ghost'
                        onClick={() => removeSelectedUser(user.id)}>
                        <CircleX className='size-4' />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant='outline'>{loc.no.common.cancel}</Button>
              </DialogClose>
              <Button
                type='button'
                onClick={handleAddParticipants}
                disabled={selectedUserIds.length === 0}>
                {loc.no.session.rsvp.manage.addSelected}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {accumulatedSignups.length === 0 && (
        <Empty className='border border-input text-sm text-muted-foreground'>
          {loc.no.common.noItems}
        </Empty>
      )}

      {responseOptions.map(({ response }) => {
        const responseSignups = accumulatedSignups.filter(
          s => s.response === response
        )
        if (responseSignups.length === 0) return undefined
        return (
          <div key={response} className='flex flex-col'>
            <PageSubheader
              title={loc.no.session.rsvp.responses[response]}
              description={responseSignups.length.toString()}
            />
            <div className='rounded-sm bg-background-secondary'>
              {responseSignups.map(({ user }) => {
                return (
                  <UserRow
                    key={user.id}
                    item={user}
                    className='w-full py-1 first:pt-2 last:pb-2'
                    hideRanking>
                    {isAdmin && (
                      <Select
                        value={response}
                        onValueChange={value =>
                          handleRsvp(value as SessionResponse, user)
                        }
                        disabled={disabled}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {responseOptions.map(({ response, Icon }) => (
                            <SelectItem key={response} value={response}>
                              <Icon className='size-4' />
                              {loc.no.session.rsvp.responses[response]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </UserRow>
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
      <div className='flex h-dvh w-full items-center-safe justify-center-safe'>
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
        className='rounded-sm border bg-background p-2'
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
