import { PageSubheader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
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
import type { UserInfo } from '@common/models/user'
import { isUpcoming } from '@common/utils/date'
import { useMemo, type ComponentProps } from 'react'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'
import type { SessionResponse } from '../../../backend/database/schema'
import ManageSessionParticipantsDialog from './ManageSessionParticipantsDialog'
import { getUserSortName, RESPONSE_OPTIONS } from './session-signup-utils'

export default function SessionSignupPanel({
  session,
  disabled,
  className,
  ...rest
}: Readonly<
  { session: SessionWithSignups; disabled?: boolean } & ComponentProps<'div'>
>) {
  const { socket } = useConnection()
  const { loggedInUser, isLoggedIn } = useAuth()
  const { users, isLoadingData } = useData()

  const myResponse = session.signups.find(
    s => s.user.id === loggedInUser?.id
  )?.response

  const canManageSignups = isLoggedIn && loggedInUser.role !== 'user'

  const sortedSignups = useMemo(
    () =>
      session.signups.toSorted((a, b) =>
        getUserSortName(a.user).localeCompare(getUserSortName(b.user))
      ),
    [session.signups]
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
          getUserSortName(a).localeCompare(getUserSortName(b))
        ) ?? [],
    [users, signedUpUserIds]
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
    toast.promise(updateSignup(response, user ?? loggedInUser), {
      loading: loc.no.session.rsvp.response.loading,
      success: loc.no.session.rsvp.response.success(response),
      error: loc.no.session.rsvp.response.error,
    })
  }

  async function addParticipants(response: SessionResponse, users: UserInfo[]) {
    await Promise.all(users.map(user => updateSignup(response, user)))
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
          {(isUpcoming(session) || canManageSignups) &&
            isLoggedIn &&
            myResponse && (
              <Select
                disabled={disabled}
                value={myResponse}
                onValueChange={handleRsvp}>
                <SelectTrigger className='w-[160px]'>
                  <SelectValue placeholder={loc.no.session.rsvp.change} />
                </SelectTrigger>
                <SelectContent>
                  {RESPONSE_OPTIONS.map(({ response, Icon }) => (
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
        {RESPONSE_OPTIONS.map(({ response, Icon }) => (
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

      {canManageSignups && (
        <ManageSessionParticipantsDialog
          availableUsers={availableUsers}
          disabled={disabled}
          onAddParticipants={addParticipants}
        />
      )}

      {sortedSignups.length === 0 && (
        <Empty className='border border-input text-sm text-muted-foreground'>
          {loc.no.common.noItems}
        </Empty>
      )}

      {RESPONSE_OPTIONS.map(({ response }) => {
        const responseSignups = sortedSignups.filter(
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
                    {canManageSignups && (
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
                          {RESPONSE_OPTIONS.map(({ response, Icon }) => (
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
