import { useAuth } from '@/contexts/useAuth'
import { useConnection } from '@/contexts/useConnection'
import { useObjectState } from '@/hooks/useObjectState'
import loc from '@/lib/locales'
import type { SessionWithSignups } from '@common/models/session'
import type { ComponentProps, SubmitEvent } from 'react'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'
import type { SessionStatus } from '../../../backend/database/schema'
import { CalendarField, Field, SelectField, TextField } from '../FormFields'

type SessionFormProps = {
  session?: SessionWithSignups
  disabled?: boolean
  onSubmitResponse?: (success: boolean) => void
} & ({ variant: 'edit'; session: SessionWithSignups } | { variant: 'create' }) &
  ComponentProps<'form'>

export default function SessionForm({
  session,
  variant,
  className,
  disabled,
  onSubmitResponse,
  ...rest
}: Readonly<SessionFormProps>) {
  const { socket } = useConnection()
  const { loggedInUser, isLoggedIn } = useAuth()

  const [form, setForm] = useObjectState({
    name: session?.name ?? '',
    description: session?.description ?? '',
    date: session?.date ? new Date(session.date) : undefined,
    location: session?.location ?? '',
    status: session?.status ?? 'confirmed',
  })
  const { name, description, date, location, status } = form

  const isAdmin = isLoggedIn && loggedInUser.role === 'admin'
  const isModerator = isLoggedIn && loggedInUser.role === 'moderator'
  const canCreate = isAdmin || isModerator

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!date) return toast.error('Dato er påkrevd')

    switch (variant) {
      case 'create':
        if (!canCreate) {
          toast.error(loc.no.error.messages.insufficient_permissions)
          return
        }
        return toast.promise(
          socket
            .emitWithAck('create_session', {
              type: 'CreateSessionRequest',
              name,
              description: description || undefined,
              date,
              location: location || undefined,
              status,
            })
            .then(r => {
              onSubmitResponse?.(r.success)
              if (!r.success) throw new Error(r.message)
              return r
            }),
          loc.no.session.create.request
        )

      case 'edit':
        if (!canCreate) {
          toast.error(loc.no.error.messages.insufficient_permissions)
          return
        }
        return toast.promise(
          socket
            .emitWithAck('edit_session', {
              type: 'EditSessionRequest',
              id: session.id,
              name,
              description: description || undefined,
              date,
              location: location || undefined,
              status,
            })
            .then(r => {
              onSubmitResponse?.(r.success)
              if (!r.success) throw new Error(r.message)
              return r
            }),
          loc.no.session.editRequest
        )
    }
  }

  return (
    <form
      className={twMerge('grid gap-4', className)}
      onSubmit={handleSubmit}
      {...rest}>
      <Field
        id='name'
        name={loc.no.session.form.name}
        type='text'
        disabled={disabled}
        required
        value={name}
        onChange={e => setForm({ name: e.target.value })}
        placeholder='Mine favorite baner'
      />

      <CalendarField
        id='date'
        name={loc.no.session.form.date}
        selected={date}
        onSelect={date => setForm({ date })}
        disabled={disabled}
        required
      />

      <Field
        id='location'
        name={loc.no.session.form.location}
        type='text'
        disabled={disabled}
        value={location}
        onChange={e => setForm({ location: e.target.value })}
        placeholder='Oslo, Stasjonsgata 10'
      />

      <SelectField
        id='status'
        name={loc.no.session.form.status}
        disabled={disabled}
        required
        value={status}
        onValueChange={status => setForm({ status })}
        entries={Object.entries(loc.no.session.statusOptions).map(
          ([key, label]) =>
            ({ key, label }) as { key: SessionStatus; label: string }
        )}
      />

      <TextField
        id='description'
        name={loc.no.session.form.description}
        disabled={disabled}
        value={description}
        onChange={e => setForm({ description: e.target.value })}
        placeholder='En kort beskrivelse av sesjonen'
      />
    </form>
  )
}
