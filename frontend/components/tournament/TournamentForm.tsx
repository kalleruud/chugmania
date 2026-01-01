import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import loc from '@/lib/locales'
import type { EliminationType } from '@common/models/tournament'
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
  const [eliminationType, setEliminationType] =
    useState<EliminationType>('single')

  const isAdmin = isLoggedIn && loggedInUser.role === 'admin'
  const isModerator = isLoggedIn && loggedInUser.role === 'moderator'
  const canCreate = isAdmin || isModerator

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!canCreate) {
      toast.error(loc.no.error.messages.insufficient_permissions)
      return
    }

    if (groupsCount < 1 || groupsCount > 8) {
      toast.error('Number of groups must be between 1 and 8')
      return
    }

    if (advancementCount < 1 || advancementCount > 4) {
      toast.error('Number advancing per group must be between 1 and 4')
      return
    }

    return toast.promise(
      socket
        .emitWithAck('create_tournament', {
          type: 'CreateTournamentRequest',
          session: sessionId,
          name,
          description: description || undefined,
          groupsCount,
          advancementCount,
          eliminationType,
        })
        .then(r => {
          onSubmitResponse?.(r.success)
          if (!r.success) throw new Error(r.message)
          return r
        }),
      {
        loading: 'Creating tournament...',
        success: 'Tournament created successfully',
        error: (err: Error) => `Failed to create tournament: ${err.message}`,
      }
    )
  }

  return (
    <form
      className={twMerge('grid gap-4', className)}
      onSubmit={handleSubmit}
      {...rest}>
      <Field
        id='name'
        name='Tournament Name'
        type='text'
        disabled={disabled}
        required
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder='Championship 2024'
      />

      <div className='grid grid-cols-2 gap-4'>
        <Field
          id='groupsCount'
          name='Number of Groups'
          type='number'
          disabled={disabled}
          required
          min={1}
          max={8}
          value={groupsCount}
          onChange={e => setGroupsCount(Number(e.target.value))}
        />

        <Field
          id='advancementCount'
          name='Advancing per Group'
          type='number'
          disabled={disabled}
          required
          min={1}
          max={4}
          value={advancementCount}
          onChange={e => setAdvancementCount(Number(e.target.value))}
        />
      </div>

      <SelectField
        id='eliminationType'
        name='Elimination Type'
        disabled={disabled}
        required
        value={eliminationType}
        onValueChange={setEliminationType}
        entries={[
          { key: 'single', label: 'Single Elimination' },
          { key: 'double', label: 'Double Elimination' },
        ]}
      />

      <TextField
        id='description'
        name='Description'
        disabled={disabled}
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder='Tournament details...'
      />
    </form>
  )
}
