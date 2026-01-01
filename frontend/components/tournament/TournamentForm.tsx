import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import loc from '@/lib/locales'
import type { CreateTournamentRequest } from '@common/models/tournament'
import { useState, type ComponentProps, type FormEvent } from 'react'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'
import { Field, SelectField, TextField } from '../FormFields'

type TournamentFormProps = {
  sessionId: string
  disabled?: boolean
  onSubmitResponse?: (success: boolean) => void
} & ComponentProps<'form'>

export default function TournamentForm({
  sessionId,
  className,
  disabled,
  onSubmitResponse,
  ...rest
}: Readonly<TournamentFormProps>) {
  const { socket } = useConnection()
  const { loggedInUser, isLoggedIn } = useAuth()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [groupsCount, setGroupsCount] = useState(2)
  const [advancementCount, setAdvancementCount] = useState(2)
  const [eliminationType, setEliminationType] = useState<'single' | 'double'>(
    'single'
  )

  const isAdmin = isLoggedIn && loggedInUser.role === 'admin'
  const isModerator = isLoggedIn && loggedInUser.role === 'moderator'
  const canCreate = isAdmin || isModerator

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!canCreate) {
      toast.error(loc.no.error.messages.insufficient_permissions)
      return
    }

    if (!name.trim()) {
      toast.error('Navn er påkrevd')
      return
    }

    const validGroupsCount =
      Number.isInteger(groupsCount) && groupsCount > 0 ? groupsCount : 2
    const validAdvancementCount =
      Number.isInteger(advancementCount) && advancementCount > 0
        ? advancementCount
        : 2

    const payload: CreateTournamentRequest = {
      type: 'CreateTournamentRequest',
      session: sessionId,
      name: name.trim(),
      description: description?.trim() || undefined,
      groupsCount: validGroupsCount,
      advancementCount: validAdvancementCount,
      eliminationType,
    }

    return toast.promise(
      socket.emitWithAck('create_tournament', payload).then(r => {
        onSubmitResponse?.(r.success)
        if (!r.success) throw new Error(r.message)
        setName('')
        setDescription('')
        setGroupsCount(2)
        setAdvancementCount(2)
        setEliminationType('single')
        return r
      }),
      {
        loading: 'Oppretter turnering...',
        success: 'Turnering opprettet',
        error: (err: Error) => `Opprettelse feilet: ${err.message}`,
      }
    )
  }

  return (
    <form
      className={twMerge('grid gap-4', className)}
      onSubmit={handleSubmit}
      {...rest}>
      <Field
        id='tournament-name'
        name='Navn'
        type='text'
        disabled={disabled}
        required
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder='Turnering navn'
      />

      <TextField
        id='tournament-description'
        name='Beskrivelse'
        disabled={disabled}
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder='En kort beskrivelse av turneringen'
      />

      <Field
        id='groups-count'
        name='Antall grupper'
        type='number'
        disabled={disabled}
        required
        min={1}
        max={10}
        value={groupsCount.toString()}
        onChange={e => {
          const val = Number.parseInt(e.target.value, 10)
          if (!Number.isNaN(val) && val >= 1 && val <= 10) {
            setGroupsCount(val)
          }
        }}
      />

      <Field
        id='advancement-count'
        name='Antall spillere som går videre per gruppe'
        type='number'
        disabled={disabled}
        required
        min={1}
        max={10}
        value={advancementCount.toString()}
        onChange={e => {
          const val = Number.parseInt(e.target.value, 10)
          if (!Number.isNaN(val) && val >= 1 && val <= 10) {
            setAdvancementCount(val)
          }
        }}
      />

      <SelectField
        id='elimination-type'
        name='Eliminasjonstype'
        disabled={disabled}
        required
        value={eliminationType}
        onValueChange={value =>
          setEliminationType(value as 'single' | 'double')
        }
        entries={[
          { key: 'single', label: 'Single Elimination' },
          { key: 'double', label: 'Double Elimination' },
        ]}
      />
    </form>
  )
}
