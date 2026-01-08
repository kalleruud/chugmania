import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import { sessionToLookupItem, trackToLookupItem } from '@/lib/lookup-utils'
import type {
  CreateTournament,
  TournamentEliminationType,
  TournamentPreview,
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
import { PageHeader, PageSubheader } from '../PageHeader'
import { SessionRow } from '../session/SessionRow'
import { TrackRow } from '../track/TrackRow'
import { Alert, AlertTitle } from '../ui/alert'
import { Label } from '../ui/label'
import { Spinner } from '../ui/spinner'
import GroupCard from './GroupCard'

type TournamentFormProps = Partial<CreateTournament> & ComponentProps<'form'>

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

export default function TournamentForm(props: Readonly<TournamentFormProps>) {
  const { socket } = useConnection()
  const navigate = useNavigate()
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
    useState<TournamentEliminationType>('single')
  const [groupStageTracks, setGroupStageTracks] = useState<string[]>([])

  const session = sessions?.find(s => s.id === selectedSessionId)
  const signedUpPlayers = useMemo(() => {
    if (!session || !users) return []
    return session.signups
      .filter(s => s.response === 'yes')
      .map(s => users.find(u => u.id === s.user.id))
      .filter(u => u !== undefined)
  }, [session, users])

  const maxMatchesPerPlayer = useMemo(() => {
    return calculateMaxMatchesPerPlayer(
      preview?.groups.at(-1)?.players.length ?? 0,
      advancementCount * groupsCount,
      eliminationType
    )
  }, [preview, advancementCount, groupsCount, eliminationType])

  // Calculate recommended number of tracks so each is used ~2 times
  const recommendedTrackCount = useMemo(() => {
    if (!preview?.groupStageRounds) return 0
    return Math.ceil(preview.groupStageRounds / 2)
  }, [preview?.groupStageRounds])

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
    if (!selectedSessionId) return
    socket
      .emitWithAck('get_tournament_preview', {
        type: 'TournamentPreviewRequest',
        session: selectedSessionId,
        name: name || 'Forhåndsvisning',
        description: description === '' ? undefined : description,
        groupsCount,
        advancementCount,
        eliminationType,
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
          onValueChange={value =>
            setEliminationType(value as TournamentEliminationType)
          }
        />

        {preview &&
          preview.groupStageRounds > 0 &&
          recommendedTrackCount > 0 && (
            <div className='flex flex-col gap-2'>
              <Label>{loc.no.tournament.form.groupStageTracks}</Label>
              <p className='text-muted-foreground text-xs'>
                {loc.no.tournament.form.groupStageTracksHint} (
                {preview.groupStageRounds} runder, anbefalt{' '}
                {recommendedTrackCount} baner)
              </p>
              {Array.from({ length: recommendedTrackCount }, (_, i) => {
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
                          while (
                            next.length > 0 &&
                            next[next.length - 1] === undefined
                          ) {
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
      </div>

      {preview && (
        <div className='bg-background flex flex-col gap-4 rounded-sm border p-4'>
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
              <span>{`${Math.max(0, (preview.groups.at(0)?.players.length ?? 0) - 1)} - ${maxMatchesPerPlayer}`}</span>
            </div>
            <div className='flex items-center justify-between'>
              <span>Antall runder i gruppespill</span>
              <span>{preview.groupStageRounds}</span>
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
