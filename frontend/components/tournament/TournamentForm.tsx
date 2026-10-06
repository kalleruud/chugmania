import ConfirmationButton from '@/components/ConfirmationButton'
import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import { trackToLookupItem } from '@/lib/lookup-utils'
import loc from '@common/locale/locales'
import {
  isPreviewVisibility,
  type TournamentConfig,
  type TournamentDetails,
} from '@common/models/tournament'
import { getTournamentStages, stageName } from '@common/utils/tournament'
import { useState, type SubmitEvent } from 'react'
import { toast } from 'sonner'
import ComboboxMulti from '../ComboboxMulti'
import Combobox from '../combobox'
import { TrackRow } from '../track/TrackRow'
import { Button } from '../ui/button'
import { NativeSelect } from '../ui/native-select'
import DeleteTournamentDialog from './DeleteTournamentDialog'

export default function TournamentForm({
  details,
}: {
  details: TournamentDetails
}) {
  const { socket, isConnected } = useConnection()
  const { tracks, applyTournamentDetails } = useData()
  const [input, setInput] = useState({
    config: details.config,
    base: details.config,
    configKey: details.configKey,
  })
  const [saving, setSaving] = useState(false)
  const [starting, setStarting] = useState(false)
  const dirty = JSON.stringify(input.config) !== JSON.stringify(input.base)
  const editor =
    dirty || saving
      ? input
      : {
          config: details.config,
          base: details.config,
          configKey: details.configKey,
        }
  const config = editor.config
  const conflict = dirty && editor.configKey !== details.configKey
  const disabled = saving || starting || !isConnected || details.cancelled
  const count = details.participants.length
  const stages = getTournamentStages(
    config,
    Math.max(count, config.groupsCount + 1)
  )
  const items =
    tracks?.filter(track => !track.deletedAt).map(trackToLookupItem) ?? []

  function change(next: TournamentConfig) {
    setInput({ ...editor, config: next })
  }

  function discard() {
    setInput({
      config: details.config,
      base: details.config,
      configKey: details.configKey,
    })
  }

  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (disabled || !dirty || conflict || !editor.configKey) return
    setSaving(true)
    try {
      const response = await socket.emitWithAck('update_tournament', {
        config,
        configKey: editor.configKey,
      })
      if (!response.success) {
        if ('details' in response)
          applyTournamentDetails(response.details, config.session)
        throw new Error(response.message)
      }
      applyTournamentDetails(response.details, config.session)
      if (response.details)
        setInput({
          config: response.details.config,
          base: response.details.config,
          configKey: response.details.configKey,
        })
      toast.success(loc.no.tournament.saved)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }

  async function start() {
    if (
      disabled ||
      dirty ||
      conflict ||
      details.notReadyReason ||
      !details.previewKey
    )
      return
    setStarting(true)
    try {
      const response = await socket.emitWithAck('start_tournament', {
        session: config.session,
        previewKey: details.previewKey,
      })
      if (!response.success) {
        if ('details' in response)
          applyTournamentDetails(response.details, config.session)
        throw new Error(response.message)
      }
      applyTournamentDetails(response.details, config.session)
      toast.success(loc.no.tournament.started)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setStarting(false)
    }
  }

  return (
    <form
      onSubmit={save}
      className='flex min-w-0 flex-col gap-4 rounded-sm border bg-background p-4'>
      <header className='flex items-center justify-between gap-2'>
        <h3>{loc.no.tournament.adminPanel}</h3>
        <DeleteTournamentDialog
          session={config.session}
          isDraft
          disabled={saving || starting}
        />
      </header>
      <fieldset disabled={disabled} className='flex min-w-0 flex-col gap-4'>
        <div className='flex gap-2'>
          <label className='w-full'>
            Grupper
            <NativeSelect
              value={config.groupsCount}
              onChange={e =>
                change({ ...config, groupsCount: Number(e.target.value) })
              }>
              {[1, 2, 4, 8, 16].map(count => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className='w-full'>
            Videre fra hver gruppe
            <NativeSelect
              value={config.advancementCount}
              onChange={e =>
                change({ ...config, advancementCount: Number(e.target.value) })
              }>
              {[1, 2, 3, 4].map(count => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </NativeSelect>
          </label>
        </div>
        <label>
          Forhåndsvisning for deltakere
          <NativeSelect
            value={config.previewVisibility}
            onChange={event => {
              if (isPreviewVisibility(event.target.value))
                change({ ...config, previewVisibility: event.target.value })
            }}>
            <option value='visible'>Vis alt</option>
            <option value='hide_tracks'>Skjul baner</option>
            <option value='groups_only'>Skjul sluttspill</option>
            <option value='stats_only'>Skjul alt</option>
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
            <option value='double'>Dobbel eliminering</option>
          </NativeSelect>
        </label>
        <label>
          {loc.no.tournament.tieBreakerTrack}
          <Combobox
            items={items}
            CustomRow={TrackRow}
            selected={
              items.find(item => item.id === config.tieBreakerTrack) ?? null
            }
            setSelected={item =>
              change({ ...config, tieBreakerTrack: item?.id ?? null })
            }
            required
            placeholder={loc.no.tournament.tieBreakerTrackRequired}
          />
        </label>
        {stages.map(stage => (
          <div key={stage}>
            <p>{stageName(stage)}</p>
            <ComboboxMulti
              items={items}
              CustomRow={TrackRow}
              selected={(config.stageTracks[stage] ?? []).flatMap(id => {
                const item = items.find(track => track.id === id)
                return item ? [item] : []
              })}
              setSelected={selected =>
                change({
                  ...config,
                  stageTracks: {
                    ...config.stageTracks,
                    [stage]: selected.map(track => track.id),
                  },
                })
              }
              placeholder='Velg baner i rekkefølge'
            />
          </div>
        ))}
      </fieldset>
      {details.notReadyReason &&
        details.notReadyReason !== loc.no.tournament.awaitingSignups && (
          <p role='status' className='text-sm text-muted-foreground'>
            {details.notReadyReason}
          </p>
        )}
      {dirty && (
        <p role='status' className='text-sm text-muted-foreground'>
          {loc.no.tournament.unsaved}
        </p>
      )}
      {conflict && (
        <p role='alert' className='text-sm text-destructive'>
          {loc.no.tournament.configConflict}
        </p>
      )}
      <div className='flex flex-wrap gap-2'>
        <Button type='submit' disabled={disabled || !dirty || conflict}>
          {loc.no.tournament.saveChanges}
        </Button>
        {dirty && (
          <Button
            type='button'
            variant='outline'
            disabled={saving || starting}
            onClick={discard}>
            {conflict ? loc.no.tournament.reload : loc.no.tournament.discard}
          </Button>
        )}
        <ConfirmationButton
          key={details.previewKey}
          type='button'
          disabled={
            disabled ||
            dirty ||
            conflict ||
            !!details.notReadyReason ||
            !details.previewKey
          }
          confirmText={loc.no.tournament.startConfirm}
          onClick={() => void start()}>
          {loc.no.tournament.start}
        </ConfirmationButton>
      </div>
    </form>
  )
}
