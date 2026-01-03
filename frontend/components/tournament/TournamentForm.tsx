import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import { sessionToLookupItem } from '@/lib/lookup-utils'
import type { EliminationType } from '@backend/database/schema'
import type {
  CreateTournament,
  TournamentPreview,
} from '@common/models/tournament'
import { Users } from 'lucide-react'
import { useEffect, useMemo, useState, type ComponentProps } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import Combobox from '../combobox'
import { Field, SelectField, TextField } from '../FormFields'
import { SessionRow } from '../session/SessionRow'
import { Alert, AlertTitle } from '../ui/alert'
import { Spinner } from '../ui/spinner'

type TournamentFormProps = Partial<CreateTournament> & ComponentProps<'form'>

export default function TournamentForm(props: Readonly<TournamentFormProps>) {
  const { socket } = useConnection()
  const { sessions, rankings, users, tracks, isLoadingData } = useData()
  const [searchParams, setSearchParams] = useSearchParams()

  const selectedSessionId = searchParams.get('session')

  const [preview, setPreview] = useState<TournamentPreview | undefined>(
    undefined
  )

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [groupsCount, setGroupsCount] = useState(2)
  const [advancementCount, setAdvancementCount] = useState(1)
  const [eliminationType, setEliminationType] =
    useState<EliminationType>('single')

  const session = sessions?.find(s => s.id === selectedSessionId)
  const signedUpPlayers = useMemo(() => {
    if (!session || !users) return []
    return session.signups
      .filter(s => s.response === 'yes')
      .map(s => users.find(u => u.id === s.user.id))
      .filter(u => u !== undefined)
  }, [session, users])

  function handleSessionChange(sessionId: string) {
    if (sessionId) {
      setSearchParams(prev => {
        prev.set('session', sessionId)
        return prev
      })
    } else {
      setSearchParams(prev => {
        prev.delete('session')
        return prev
      })
    }
  }

  useEffect(() => {
    requestPreview()
  }, [selectedSessionId, groupsCount, advancementCount, eliminationType])

  const requestPreview = () => {
    if (!selectedSessionId || name === '') return
    socket
      .emitWithAck('get_tournament_preview', {
        type: 'TournamentPreviewRequest',
        session: selectedSessionId,
        name,
        description: description === '' ? undefined : description,
        groupsCount,
        advancementCount,
        eliminationType,
        groupStageTracks: [],
        bracketTracks: [],
      })
      .then(r => {
        if (!r.success) return toast.error(r.message)
        setPreview(r.tournament)
      })
  }

  const handleSubmit = () => {
    // TODO: Sends the current form state to the backend to create the tournament
  }

  if (isLoadingData)
    return (
      <div className='h-dvh-safe flex w-full items-center justify-center'>
        <Spinner />
      </div>
    )

  return (
    <form className='flex flex-col gap-4' onSubmit={handleSubmit} {...props}>
      <div className='bg-background flex flex-col gap-4 rounded-sm border p-4'>
        <Field
          id='name'
          name={loc.no.tournament.form.name}
          type='text'
          required
          value={name}
          onChange={e => setName(e.target.value)}
        />

        <TextField
          id='description'
          name={loc.no.tournament.form.description}
          value={description}
          onChange={e => setDescription(e.target.value)}
        />

        <div className='flex flex-col gap-2'>
          <Combobox
            id='session'
            name={loc.no.tournament.form.session}
            required
            placeholder={loc.no.tournament.form.session}
            items={sessions
              ?.filter(s => s.status !== 'cancelled')
              .map(sessionToLookupItem)}
            selected={session ? sessionToLookupItem(session) : null}
            setSelected={value => handleSessionChange(value?.id ?? '')}
            limit={2}
            CustomRow={SessionRow}
          />
          {session && (
            <Alert>
              <Users />
              <AlertTitle>{signedUpPlayers.length} spillere</AlertTitle>
            </Alert>
          )}
        </div>

        <div className='flex gap-2'>
          <SelectField
            id='groupsCount'
            name={loc.no.tournament.form.groupsCount}
            entries={Array.from(
              { length: Math.ceil(Math.log2(signedUpPlayers.length / 2)) },
              (_, i) => ({
                key: (2 ** (i + 1)).toString(),
                label: `${2 ** (i + 1)}`,
              })
            )}
            value={groupsCount.toString()}
            onValueChange={value => setGroupsCount(Number(value))}
          />

          <SelectField
            id='advancementCount'
            name={loc.no.tournament.form.advancementCount}
            entries={Array.from(
              { length: Math.ceil(signedUpPlayers.length / groupsCount) },
              (_, i) => ({
                key: (i + 1).toString(),
                label: (i + 1).toString(),
              })
            )}
            value={advancementCount.toString()}
            onValueChange={value => setAdvancementCount(Number(value))}
          />
        </div>

        <SelectField
          id='eliminationType'
          name={loc.no.tournament.form.eliminationType}
          entries={Object.entries(loc.no.tournament.eliminationType).map(
            ([key, label]) => ({
              key,
              label,
            })
          )}
          value={eliminationType}
          onValueChange={value => setEliminationType(value as EliminationType)}
        />
      </div>

      {/* TODO: Display group preview */}

      {preview && (
        <div className='bg-background flex flex-col gap-4 rounded-sm border p-4'>
          <h2 className='text-lg font-bold'>Forhåndsvisning</h2>
          <p>{preview.name}</p>
        </div>
      )}
    </form>
  )
}
