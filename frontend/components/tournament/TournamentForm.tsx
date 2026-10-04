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
import { AlertCircleIcon } from 'lucide-react'
import { useEffect, useState, type SubmitEvent } from 'react'
import { toast } from 'sonner'
import ComboboxMulti from '../ComboboxMulti'
import { TrackRow } from '../track/TrackRow'
import { Alert, AlertDescription, AlertTitle } from '../ui/alert'
import { Button } from '../ui/button'
import { NativeSelect } from '../ui/native-select'
import { Spinner } from '../ui/spinner'
import TournamentPanel from './TournamentPanel'

export default function TournamentForm({
  session,
  onCreated,
}: {
  session: string
  onCreated: () => void
}) {
  const { socket, isConnected } = useConnection()
  const { tracks, sessions, rankings } = useData()
  const [inputConfig, setConfig] = useState<TournamentConfig>({
    session,
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
    signups: sessionData?.signups,
    status: sessionData?.status,
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
    preview.details.matches.every(m => m.track)
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
        if (Object.values(config.stageTracks).some(tracks => tracks.length))
          toast.error(message)
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
    <div className='grid min-w-0 gap-6'>
      <form
        onSubmit={submit}
        className='flex min-w-0 flex-col gap-4 rounded-sm border bg-background p-2'>
        <div className='flex gap-2'>
          <label className='w-full'>
            Grupper
            <NativeSelect
              value={config.groupsCount}
              onChange={e =>
                setConfig({ ...config, groupsCount: Number(e.target.value) })
              }>
              {groups.map(g => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className='w-full'>
            Videre fra hver gruppe
            <NativeSelect
              value={config.advancementCount}
              onChange={e =>
                setConfig({
                  ...config,
                  advancementCount: Number(e.target.value),
                })
              }>
              {advancements.map(a => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </NativeSelect>
          </label>
        </div>
        <label>
          Format
          <NativeSelect
            value={config.eliminationType}
            onChange={e => {
              if (e.target.value === 'single' || e.target.value === 'double')
                setConfig({ ...config, eliminationType: e.target.value })
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
              CustomRow={TrackRow}
              selected={(config.stageTracks[stage] ?? []).flatMap(id => {
                const item = items.find(t => t.id === id)
                return item ? [item] : []
              })}
              setSelected={selected =>
                setConfig({
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
        {error && (
          <Alert variant='destructive'>
            <AlertCircleIcon />
            <AlertTitle>{loc.no.error.title}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button disabled={!ready} type='submit'>
          {loc.no.tournament.create}
        </Button>
      </form>
      <div className='min-w-0 self-start lg:sticky lg:top-4'>
        {loading && <Spinner className='mt-8 w-full' />}
        {preview && <TournamentPanel details={preview.details} isPreview />}
      </div>
    </div>
  )
}
