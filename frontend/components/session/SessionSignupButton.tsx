import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import type { SessionResponse } from '@backend/database/schema'
import loc from '@common/locale/locales'
import type { SessionWithSignups } from '@common/models/session'
import { isPast } from '@common/utils/date'
import { PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { RESPONSE_OPTIONS } from './session-signup-utils'

export default function SessionSignupButton({
  session,
}: Readonly<{ session: SessionWithSignups }>) {
  const { loggedInUser, isLoggedIn, isLoading } = useAuth()
  const { socket, isConnected } = useConnection()
  const [saving, setSaving] = useState(false)
  const signup = session.signups.find(s => s.user.id === loggedInUser?.id)
  const canManageSignups = isLoggedIn && loggedInUser.role !== 'user'
  const disabled =
    !isLoggedIn ||
    isLoading ||
    !isConnected ||
    saving ||
    session.status === 'cancelled' ||
    (isPast(session) && !canManageSignups)

  function updateSignup(response: SessionResponse) {
    if (disabled) return
    setSaving(true)
    toast.promise(
      socket
        .emitWithAck('rsvp_session', {
          type: 'RsvpSessionRequest',
          session: session.id,
          user: loggedInUser.id,
          response,
        })
        .then(result => {
          if (!result.success) throw new Error(result.message)
        })
        .finally(() => setSaving(false)),
      {
        loading: loc.no.session.rsvp.response.loading,
        success: loc.no.session.rsvp.response.success(response),
        error: loc.no.session.rsvp.response.error,
      }
    )
  }

  if (!signup)
    return (
      <Button
        type='button'
        size='sm'
        disabled={disabled}
        onClick={() => updateSignup('yes')}>
        <PlusIcon />
        {loc.no.session.rsvp.signup}
      </Button>
    )

  return (
    <Select
      value={signup.response}
      onValueChange={value => {
        const option = RESPONSE_OPTIONS.find(
          option => option.response === value
        )
        if (option) updateSignup(option.response)
      }}
      disabled={disabled}>
      <SelectTrigger size='sm' aria-label={loc.no.session.rsvp.change}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align='end'>
        {RESPONSE_OPTIONS.map(({ response, Icon }) => (
          <SelectItem key={response} value={response}>
            <Icon className='size-4' />
            {loc.no.session.rsvp.responses[response]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
