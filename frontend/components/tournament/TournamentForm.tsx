import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import { sessionToLookupItem, trackToLookupItem } from '@/lib/lookup-utils'
import type {
  CreateTournament,
  TournamentEliminationType,
  TournamentWithDetails,
} from '@common/models/tournament'
import { Users } from 'lucide-react'
import {
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type FormEvent,
} from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import Combobox from '../combobox'
import { Field, SelectField, TextField } from '../FormFields'
import { SessionRow } from '../session/SessionRow'
import { TrackRow } from '../track/TrackRow'
import { Alert, AlertTitle } from '../ui/alert'
import { Checkbox } from '../ui/checkbox'
import { Label } from '../ui/label'
import { Spinner } from '../ui/spinner'
import TournamentCard from './TournamentCard'

type TournamentFormProps = Partial<CreateTournament> & ComponentProps<'form'>

export default function TournamentForm(props: Readonly<TournamentFormProps>) {
  const { socket } = useConnection()
  const navigate = useNavigate()
  const { sessions, users, tracks, isLoadingData } = useData()
  const [searchParams, setSearchParams] = useSearchParams()

  const selectedSessionId = searchParams.get('session')

  const [preview, setPreview] = useState<TournamentWithDetails | undefined>(
    undefined
  )

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [groupsCount, setGroupsCount] = useState(2)
  const [advancementCount, setAdvancementCount] = useState(1)
  const [eliminationType, setEliminationType] =
    useState<TournamentEliminationType>('single')
  const [groupStageTracks, setGroupStageTracks] = useState<string[]>([])
  const [simulate, setSimulate] = useState(false)

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
  }, [
    selectedSessionId,
    groupsCount,
    advancementCount,
    eliminationType,
    simulate,
  ])

  const requestPreview = () => {
    if (!selectedSessionId) return
    socket
      .emitWithAck('get_tournament_preview', {
        type: 'TournamentPreviewRequest',
        session: selectedSessionId,
        name: 'Forhåndsvisning',
        description: description === '' ? undefined : description,
        groupsCount,
        advancementCount,
        eliminationType,
        simulate,
      })
      .then(r => {
        if (!r.success) return toast.error(r.message)
        setPreview(r.tournament)
      })
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
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
          groupStageTracks:
            groupStageTracks.length > 0 ? groupStageTracks : undefined,
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
      <div className='h-dvh-safe flex w-full items-center justify-center'>
        <Spinner />
      </div>
    )

  return (
    <div className='flex flex-col gap-4'>
      <form
        className='bg-background flex flex-col gap-4 rounded-sm border p-4'
        onSubmit={handleSubmit}
        {...props}>
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
          onValueChange={value =>
            setEliminationType(value as TournamentEliminationType)
          }
        />

        <Label className='hover:bg-accent/20 has-aria-checked:border-blue-600 has-aria-checked:bg-blue-50 dark:has-aria-checked:border-primary dark:has-aria-checked:bg-primary/20 flex items-start gap-3 rounded-lg border p-3 hover:cursor-pointer'>
          <Checkbox
            id='simulate'
            checked={simulate}
            onCheckedChange={(checked: boolean | 'indeterminate') =>
              setSimulate(checked === true)
            }
            defaultChecked
          />
          <div className='grid gap-1.5 font-normal'>
            <p className='text-sm font-medium leading-none'>
              {loc.no.tournament.form.simulate}
            </p>
            <p className='text-muted-foreground text-sm'>
              {loc.no.tournament.form.simulateHint}
            </p>
          </div>
        </Label>

        {preview &&
          preview.groups.length > 0 &&
          preview.groupStageTrackCount > 0 && (
            <div className='flex flex-col gap-2'>
              <Label>{loc.no.tournament.form.groupStageTracks}</Label>
              <p className='text-muted-foreground text-xs'>
                {loc.no.tournament.form.groupStageTracksHint} (
                {preview.rounds.filter(r => r.bracket === 'group').length}{' '}
                runder, anbefalt {preview.groupStageTrackCount} baner)
              </p>
              {Array.from({ length: preview.groupStageTrackCount }, (_, i) => {
                const trackIndex = i
                const selectedTrack = tracks?.find(
                  t => t.id === groupStageTracks[trackIndex]
                )
                return (
                  <div key={trackIndex} className='flex flex-col gap-1'>
                    <Label className='text-xs'>Bane {trackIndex + 1}</Label>
                    <Combobox
                      className='w-full'
                      placeholder={loc.no.tournament.form.selectTrack}
                      items={tracks?.map(trackToLookupItem)}
                      selected={
                        selectedTrack ? trackToLookupItem(selectedTrack) : null
                      }
                      setSelected={value => {
                        setGroupStageTracks(prev => {
                          const next = [...prev]
                          if (value?.id) {
                            next[trackIndex] = value.id
                          } else {
                            next.splice(trackIndex, 1)
                          }
                          // Remove trailing empty entries
                          while (next.length > 0 && next.at(-1) === undefined) {
                            next.pop()
                          }
                          return next
                        })
                      }}
                      limit={2}
                      align='start'
                      CustomRow={TrackRow}
                    />
                  </div>
                )
              })}
            </div>
          )}
      </form>

      {preview && <TournamentCard tournament={preview} />}
    </div>
  )
}
