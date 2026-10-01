import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import { trackToLookupItem } from '@/lib/lookup-utils'
import loc from '@common/locale/locales'
import type {
  TournamentConfig,
  TournamentDetails,
} from '@common/models/tournament'
import {
  configurationOptions,
  stageName,
  usedStages,
} from '@common/utils/tournament'
import { useEffect, useState, type SubmitEvent } from 'react'
import { toast } from 'sonner'
import Combobox, { ComboboxMulti } from '../combobox'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { NativeSelect } from '../ui/native-select'
import { Spinner } from '../ui/spinner'
import TournamentPanel from './TournamentPanel'
import { TrackRow } from '../track/TrackRow'

export default function TournamentForm({
  session,
  onCreated,
}: {
  session: string
  onCreated: () => void
}) {
  const { socket, isConnected } = useConnection()
  const { tracks, sessions, timeEntries, rankings } = useData()
  const [inputConfig, setConfig] = useState<TournamentConfig>({
    session,
    name: '',
    description: '',
    qualificationTrack: '',
    groupsCount: 1,
    advancementCount: 2,
    eliminationType: 'single',
    stageTracks: {},
  })
  const [preview, setPreview] = useState<{
    key: string
    details: TournamentDetails
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const count =
    sessions
      ?.find(s => s.id === session)
      ?.signups.filter(s => s.response === 'yes').length ?? 0
  const options = configurationOptions(count, inputConfig.eliminationType)
  const choice =
    options.find(
      o =>
        o.groups === inputConfig.groupsCount &&
        o.advancement === inputConfig.advancementCount
    ) ??
    options.find(o => o.groups === inputConfig.groupsCount) ??
    options.at(0)
  const selectedConfig = {
    ...inputConfig,
    groupsCount: choice?.groups ?? inputConfig.groupsCount,
    advancementCount: choice?.advancement ?? inputConfig.advancementCount,
  }
  const stages = usedStages(selectedConfig, count)
  const config = {
    ...selectedConfig,
    stageTracks: Object.fromEntries(
      Object.entries(selectedConfig.stageTracks).filter(([stage]) =>
        stages.some(s => s === stage)
      )
    ),
  }
  const groups = [...new Set(options.map(o => o.groups))]
  const advancements = options
    .filter(o => o.groups === config.groupsCount)
    .map(o => o.advancement)
  const items = tracks?.map(trackToLookupItem) ?? []
  const sessionData = sessions?.find(s => s.id === session)
  const key = JSON.stringify({
    ...config,
    name: '',
    description: '',
    signups: sessionData?.signups,
    status: sessionData?.status,
    timeEntries,
    rankings,
    isConnected,
  })
  const ready =
    !!preview &&
    preview.key === key &&
    !loading &&
    !saving &&
    !error &&
    isConnected &&
    preview.details.matches.every(m => m.track) &&
    config.name.trim().length > 0
  function change(next: TournamentConfig) {
    setConfig(next)
  }
  useEffect(() => {
    let active = true
    const timer = setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const response = await socket.emitWithAck('preview_tournament', config)
        if (!active) return
        if (!response.success) throw new Error(response.message)
        setPreview({ key, details: response.details })
      } catch (error) {
        if (!active) return
        const message = error instanceof Error ? error.message : String(error)
        setError(message)
        if (config.qualificationTrack) toast.error(message)
      } finally {
        if (active) setLoading(false)
      }
    }, 380)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [key, socket])
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ready) return
    setSaving(true)
    try {
      const response = await socket.emitWithAck('create_tournament', config)
      if (!response.success) throw new Error(response.message)
      toast.success(loc.no.tournament.saved)
      onCreated()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className='grid min-w-0 gap-6 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]'>
      <form onSubmit={submit} className='flex min-w-0 flex-col gap-4'>
        <label>
          Navn
          <Input
            required
            value={config.name}
            onChange={e => setConfig({ ...config, name: e.target.value })}
          />
        </label>
        <label>
          Beskrivelse
          <Input
            value={config.description}
            onChange={e =>
              setConfig({ ...config, description: e.target.value })
            }
          />
        </label>
        <Combobox
          items={items}
          selected={items.find(t => t.id === config.qualificationTrack)}
          setSelected={item =>
            change({ ...config, qualificationTrack: item?.id ?? '' })
          }
          placeholder='Kvalifiseringsbane'
          CustomRow={TrackRow}
        />
        <label>
          Grupper
          <NativeSelect
            value={config.groupsCount}
            onChange={e =>
              change({ ...config, groupsCount: Number(e.target.value) })
            }>
            {groups.map(g => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label>
          Videre fra hver gruppe
          <NativeSelect
            value={config.advancementCount}
            onChange={e =>
              change({ ...config, advancementCount: Number(e.target.value) })
            }>
            {advancements.map(a => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label>
          Format
          <NativeSelect
            value={config.eliminationType}
            onChange={e => {
              if (e.target.value === 'single' || e.target.value === 'double')
                change({ ...config, eliminationType: e.target.value })
            }}>
            <option value='single'>Enkel eliminering</option>
            <option
              value='double'
              disabled={configurationOptions(count, 'double').length === 0}>
              Dobbel eliminering
            </option>
          </NativeSelect>
        </label>
        {stages.map(stage => (
          <div key={stage}>
            <h3>{stageName(stage)}</h3>
            <ComboboxMulti
              items={items}
              selected={(config.stageTracks[stage] ?? []).flatMap(id => {
                const item = items.find(t => t.id === id)
                return item ? [item] : []
              })}
              setSelected={selected =>
                change({
                  ...config,
                  stageTracks: {
                    ...config.stageTracks,
                    [stage]: selected.map(t => t.id),
                  },
                })
              }
              placeholder='Velg baner i rekkefølge'
            />
          </div>
        ))}
        <input
          aria-label='Turneringen er klar'
          className='sr-only'
          tabIndex={-1}
          value={ready ? 'ready' : ''}
          onChange={() => {}}
          ref={node => {
            node?.setCustomValidity(ready ? '' : loc.no.tournament.tracks)
          }}
        />
        {error && (
          <p role='alert' className='text-destructive'>
            {error}
          </p>
        )}
        <Button disabled={!ready} type='submit'>
          {loc.no.tournament.create}
        </Button>
      </form>
      <div className='min-w-0 self-start lg:sticky lg:top-4'>
        {loading && <Spinner />}
        {preview && <TournamentPanel details={preview.details} isPreview />}
      </div>
    </div>
  )
}
