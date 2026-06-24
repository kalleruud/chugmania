import { useConnection } from '@/contexts/useConnection'
import { useData } from '@/contexts/useData'
import { useObjectState } from '@/hooks/useObjectState'
import loc from '@/lib/locales'
import { sessionToLookupItem } from '@/lib/lookup-utils'
import type {
  CreateTournament,
  TournamentEliminationType,
  TournamentPreview,
} from '@common/models/tournament'
import { Users } from 'lucide-react'
import { useEffect, type ComponentProps, type SubmitEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import Combobox from '../combobox'
import { Field, SelectField, TextField } from '../FormFields'
import { PageHeader, PageSubheader } from '../PageHeader'
import { SessionRow } from '../session/SessionRow'
import { Alert, AlertTitle } from '../ui/alert'
import { Spinner } from '../ui/spinner'
import GroupCard from './GroupCard'

type TournamentFormProps = Partial<CreateTournament> & ComponentProps<'form'>
type TournamentFormState = {
  preview: TournamentPreview | undefined
  name: string
  description: string
  groupsCount: number
  advancementCount: number
  eliminationType: TournamentEliminationType
}

function calculateMaxMatchesPerPlayer(
  playersPerGroup: number,
  totalAdvancingPlayers: number,
  eliminationType: TournamentEliminationType
): number {
  if (playersPerGroup < 2) {
    return 0
  }

  // Group stage (round-robin)
  const groupStageMatches = playersPerGroup - 1

  // Normalize advancing players to next power of two
  const bracketSize = Math.pow(
    2,
    Math.ceil(Math.log2(Math.max(1, totalAdvancingPlayers)))
  )

  const rounds = Math.log2(bracketSize)

  let knockoutMatches: number

  if (eliminationType === 'single') {
    knockoutMatches = rounds
  } else {
    // Matches your actual double-elimination structure
    knockoutMatches = rounds + 2
  }

  return groupStageMatches + knockoutMatches
}

const eliminationTypeEntries: {
  key: TournamentEliminationType
  label: string
}[] = [
  { key: 'single', label: loc.no.tournament.eliminationType.single },
  { key: 'double', label: loc.no.tournament.eliminationType.double },
]

export default function TournamentForm(props: Readonly<TournamentFormProps>) {
  const { socket } = useConnection()
  const navigate = useNavigate()
  const { sessions, users, isLoadingData } = useData()
  const [searchParams, setSearchParams] = useSearchParams()

  const selectedSessionId = searchParams.get('session')

  const [form, setForm] = useObjectState<TournamentFormState>({
    preview: undefined,
    name: '',
    description: '',
    groupsCount: 2,
    advancementCount: 1,
    eliminationType: 'single',
  })
  const {
    preview,
    name,
    description,
    groupsCount,
    advancementCount,
    eliminationType,
  } = form

  const session = sessions?.find(s => s.id === selectedSessionId)
  const signedUpPlayers =
    session && users
      ? session.signups.reduce<typeof users>((players, signup) => {
          const user = users.find(u => u.id === signup.user.id)
          if (signup.response === 'yes' && user) players.push(user)
          return players
        }, [])
      : []

  const maxMatchesPerPlayer = calculateMaxMatchesPerPlayer(
    preview?.groups.at(-1)?.players.length ?? 0,
    advancementCount * groupsCount,
    eliminationType
  )

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
      })
      .then(r => {
        if (!r.success) return toast.error(r.message)
        setForm({ preview: r.tournament })
      })
  }, [
    advancementCount,
    description,
    eliminationType,
    groupsCount,
    name,
    selectedSessionId,
    setForm,
    socket,
  ])

  const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedSessionId)
      return toast.error(loc.no.error.messages.session_not_selected)
    toast.promise(
      socket
        .emitWithAck('create_tournament', {
          type: 'CreateTournamentRequest',
          session: selectedSessionId,
          name,
          description,
          groupsCount,
          advancementCount,
          eliminationType,
        })
        .then(r => {
          if (!r.success) throw new Error(r.message)
          navigate(`/sessions/${selectedSessionId}`)
        }),
      loc.no.tournament.toast.create
    )
  }

  if (isLoadingData)
    return (
      <div className='flex h-dvh-safe w-full items-center justify-center'>
        <Spinner />
      </div>
    )

  return (
    <form className='flex flex-col gap-4' onSubmit={handleSubmit} {...props}>
      <div className='flex flex-col gap-4 rounded-sm border bg-background p-4'>
        <Field
          id='name'
          name={loc.no.tournament.form.name}
          type='text'
          required
          value={name}
          onChange={e => setForm({ name: e.target.value })}
        />

        <TextField
          id='description'
          name={loc.no.tournament.form.description}
          value={description}
          onChange={e => setForm({ description: e.target.value })}
        />

        <div className='flex flex-col gap-2'>
          <Combobox
            id='session'
            name={loc.no.tournament.form.session}
            required
            placeholder={loc.no.tournament.form.session}
            items={sessions.reduce<ReturnType<typeof sessionToLookupItem>[]>(
              (items, session) => {
                if (session.status !== 'cancelled')
                  items.push(sessionToLookupItem(session))
                return items
              },
              []
            )}
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
            onValueChange={value => setForm({ groupsCount: Number(value) })}
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
            onValueChange={value =>
              setForm({ advancementCount: Number(value) })
            }
          />
        </div>

        <SelectField
          id='eliminationType'
          name={loc.no.tournament.form.eliminationType}
          entries={eliminationTypeEntries}
          value={eliminationType}
          onValueChange={eliminationType => setForm({ eliminationType })}
        />
      </div>

      {preview && (
        <div className='flex flex-col gap-4 rounded-sm border bg-background p-4'>
          <PageSubheader className='p-0' title={'Forhåndsvisning'} />
          <PageHeader
            className='p-0'
            title={preview.name}
            description={preview.description}
          />

          <div className='flex flex-col gap-2'>
            <div className='flex items-center justify-between'>
              <span>Totalt antall matcher</span>
              <span>{preview.matches.length}</span>
            </div>
            <div className='flex items-center justify-between'>
              <span>Antal matcher per spiller</span>
              <span>{`${(preview.groups.at(0)?.players.length ?? 0) - 1} - ${maxMatchesPerPlayer}`}</span>
            </div>
          </div>

          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            {preview.groups.map(group => (
              <GroupCard
                key={group.id}
                group={group}
                advancementCount={preview.advancementCount}
              />
            ))}
          </div>
        </div>
      )}
    </form>
  )
}
