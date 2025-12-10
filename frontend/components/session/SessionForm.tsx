import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import loc from '@/lib/locales'
import type { SessionWithSignups } from '@common/models/session'
import { useState, type ComponentProps, type FormEvent } from 'react'
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

  const [name, setName] = useState(session?.name ?? '')
  const [description, setDescription] = useState(session?.description ?? '')
  const [date, setDate] = useState<Date | undefined>(
    session?.date ? new Date(session.date) : undefined
  )
  const [location, setLocation] = useState(session?.location ?? '')
  const [status, setStatus] = useState<SessionStatus>(
    session?.status ?? 'confirmed'
  )

  const isAdmin = isLoggedIn && loggedInUser.role === 'admin'
  const isModerator = isLoggedIn && loggedInUser.role === 'moderator'
  const canCreate = isAdmin || isModerator

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
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
        onChange={e => setName(e.target.value)}
        placeholder='Mine favorite baner'
      />

      <CalendarField
        id='date'
        name={loc.no.session.form.date}
        selected={date}
        onSelect={setDate}
        disabled={disabled}
        required
      />

      <Field
        id='location'
        name={loc.no.session.form.location}
        type='text'
        disabled={disabled}
        value={location}
        onChange={e => setLocation(e.target.value)}
        placeholder='Oslo, Stasjonsgata 10'
      />

      <SelectField
        id='status'
        name={loc.no.session.form.status}
        disabled={disabled}
        required
        value={status}
        onValueChange={setStatus}
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
        onChange={e => setDescription(e.target.value)}
        placeholder='En kort beskrivelse av sesjonen'
      />
    </form>
  )
}
