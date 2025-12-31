import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import {
  generateTournamentPreview,
  getBracketStagesForTrackSelection,
} from '@/lib/tournament-utils'
import type { TournamentPreview } from '@common/models/tournament'
import type { EliminationType } from 'backend/database/schema'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { NativeSelect } from '../ui/native-select'
import { Textarea } from '../ui/textarea'

type TournamentFormProps = {
  sessionId: string
  onSuccess?: () => void
}

export default function TournamentForm({
  sessionId,
  onSuccess,
}: Readonly<TournamentFormProps>) {
  const { socket } = useConnection()
  const { sessions, rankings, users, tracks, isLoadingData } = useData()

  const [step, setStep] = useState<'config' | 'tracks'>('config')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [groupsCount, setGroupsCount] = useState(2)
  const [advancementCount, setAdvancementCount] = useState(2)
  const [eliminationType, setEliminationType] =
    useState<EliminationType>('single')

  const [groupStageTracks, setGroupStageTracks] = useState<string[]>([])
  const [bracketTracks, setBracketTracks] = useState<Map<string, string>>(
    new Map()
  )

  const session = sessions?.find(s => s.id === sessionId)
  const signedUpPlayers = useMemo(() => {
    if (!session || !users) return []
    return session.signups
      .filter(s => s.response === 'yes')
      .map(s => users.find(u => u.id === s.user.id))
      .filter((u): u is NonNullable<typeof u> => u !== undefined)
  }, [session, users])

  const preview = useMemo<TournamentPreview | null>(() => {
    if (signedUpPlayers.length < 2 || !rankings) return null
    return generateTournamentPreview(
      signedUpPlayers,
      rankings,
      groupsCount,
      advancementCount,
      eliminationType
    )
  }, [
    signedUpPlayers,
    rankings,
    groupsCount,
    advancementCount,
    eliminationType,
  ])

  const bracketStages = useMemo(
    () =>
      getBracketStagesForTrackSelection(
        groupsCount,
        advancementCount,
        eliminationType
      ),
    [groupsCount, advancementCount, eliminationType]
  )

  const canProceedToTracks = name.trim().length > 0 && preview !== null

  const allBracketTracksSelected = bracketStages.every(stage =>
    bracketTracks.has(stage)
  )
  const canSubmit = groupStageTracks.length > 0 && allBracketTracksSelected

  const handleToggleGroupTrack = (trackId: string) => {
    setGroupStageTracks(prev =>
      prev.includes(trackId)
        ? prev.filter(id => id !== trackId)
        : [...prev, trackId]
    )
  }

  const handleSetBracketTrack = (stage: string, trackId: string) => {
    setBracketTracks(prev => new Map(prev).set(stage, trackId))
  }

  const handleSubmit = () => {
    if (!preview || !canSubmit) return

    const bracketTrackAssignments = bracketStages.map(stage => ({
      stage,
      trackId: bracketTracks.get(stage) ?? '',
    }))

    toast.promise(
      socket
        .emitWithAck('create_tournament', {
          type: 'CreateTournamentRequest',
          session: sessionId,
          name,
          description: description || undefined,
          groupsCount,
          advancementCount,
          eliminationType,
          groupStageTracks,
          bracketTracks: bracketTrackAssignments,
        })
        .then(r => {
          if (!r.success) throw new Error(r.message)
          onSuccess?.()
        }),
      loc.no.tournament.toast.create
    )
  }

  if (isLoadingData) return null

  if (step === 'config') {
    return (
      <div className='flex flex-col gap-4'>
        <div className='flex flex-col gap-2'>
          <Label htmlFor='name'>{loc.no.tournament.form.name}</Label>
          <Input
            id='name'
            value={name}
            onChange={e => setName(e.target.value)}
            required
            placeholder='Vintersesong 2025'
          />
        </div>

        <div className='flex flex-col gap-2'>
          <Label htmlFor='description'>
            {loc.no.tournament.form.description}
          </Label>
          <Textarea
            id='description'
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder='Beskrivelse av turneringen...'
            rows={2}
          />
        </div>

        <div className='grid grid-cols-2 gap-4'>
          <div className='flex flex-col gap-2'>
            <Label htmlFor='groupsCount'>
              {loc.no.tournament.form.groupsCount}
            </Label>
            <NativeSelect
              id='groupsCount'
              value={groupsCount}
              onChange={e => setGroupsCount(parseInt(e.target.value, 10))}>
              {[2, 3, 4, 6, 8].map(n => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className='flex flex-col gap-2'>
            <Label htmlFor='advancementCount'>
              {loc.no.tournament.form.advancementCount}
            </Label>
            <NativeSelect
              id='advancementCount'
              value={advancementCount}
              onChange={e => setAdvancementCount(parseInt(e.target.value, 10))}>
              {[1, 2, 3, 4].map(n => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>

        <div className='flex flex-col gap-2'>
          <Label htmlFor='eliminationType'>
            {loc.no.tournament.form.eliminationType}
          </Label>
          <NativeSelect
            id='eliminationType'
            value={eliminationType}
            onChange={e =>
              setEliminationType(e.target.value as EliminationType)
            }>
            <option value='single'>
              {loc.no.tournament.eliminationType.single}
            </option>
            <option value='double'>
              {loc.no.tournament.eliminationType.double}
            </option>
          </NativeSelect>
        </div>

        {preview && (
          <div className='flex flex-col gap-4'>
            <div className='bg-background flex items-center justify-between rounded-lg border p-3'>
              <span className='text-muted-foreground text-sm'>
                {loc.no.tournament.preview.totalMatches}
              </span>
              <span className='font-f1-bold text-lg'>
                {preview.totalMatchCount}
              </span>
            </div>

            <div className='flex flex-col gap-2'>
              <Label>{loc.no.tournament.preview.groups}</Label>
              <div className='grid grid-cols-2 gap-2'>
                {preview.groups.map(group => (
                  <div
                    key={group.name}
                    className='bg-background rounded-lg border p-2'>
                    <div className='mb-1 text-xs font-medium'>{group.name}</div>
                    <div className='flex flex-col gap-0.5'>
                      {group.players.map((player, idx) => (
                        <div
                          key={player.id}
                          className={twMerge(
                            'flex items-center justify-between text-xs',
                            idx < advancementCount && 'text-primary'
                          )}>
                          <span className='truncate'>{player.name}</span>
                          <span className='text-muted-foreground'>
                            {Math.round(player.rating)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className='text-muted-foreground text-xs'>
                {preview.groupMatchCount}{' '}
                {loc.no.tournament.preview.groupMatches}
              </div>
            </div>

            <div className='flex flex-col gap-2'>
              <Label>{loc.no.tournament.preview.bracket}</Label>
              <div className='flex flex-wrap gap-2'>
                {preview.bracketStages.map(stage => (
                  <Badge key={stage.stage} variant='outline'>
                    {stage.stage} ({stage.matchCount})
                  </Badge>
                ))}
              </div>
              <div className='text-muted-foreground text-xs'>
                {preview.bracketMatchCount}{' '}
                {loc.no.tournament.preview.bracketMatches}
              </div>
            </div>
          </div>
        )}

        <Button
          onClick={() => setStep('tracks')}
          disabled={!canProceedToTracks}>
          {loc.no.tournament.preview.selectTracks}
        </Button>
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-col gap-2'>
        <Label>{loc.no.tournament.form.groupStageTracks}</Label>
        <p className='text-muted-foreground text-xs'>
          {loc.no.tournament.form.groupStageTracksHint}
        </p>
        <div className='grid grid-cols-3 gap-2'>
          {tracks?.map(track => (
            <button
              key={track.id}
              type='button'
              onClick={() => handleToggleGroupTrack(track.id)}
              className={twMerge(
                'rounded-lg border p-2 text-sm transition-colors',
                groupStageTracks.includes(track.id)
                  ? 'border-primary bg-primary/10'
                  : 'border-input hover:border-primary/50'
              )}>
              #{track.number} {track.level}
            </button>
          ))}
        </div>
        {groupStageTracks.length > 0 && preview && (
          <div className='text-muted-foreground text-xs'>
            {loc.no.tournament.form.trackDistribution(
              preview.groupMatchCount,
              groupStageTracks.length
            )}
          </div>
        )}
      </div>

      <div className='flex flex-col gap-2'>
        <Label>{loc.no.tournament.form.bracketTracks}</Label>
        <p className='text-muted-foreground text-xs'>
          {loc.no.tournament.form.bracketTracksHint}
        </p>
        <div className='flex flex-col gap-2'>
          {bracketStages.map(stage => (
            <div key={stage} className='flex items-center gap-2'>
              <span className='w-32 truncate text-sm'>{stage}</span>
              <NativeSelect
                className='flex-1'
                value={bracketTracks.get(stage) ?? ''}
                onChange={e => handleSetBracketTrack(stage, e.target.value)}>
                <option value=''>{loc.no.tournament.form.selectTrack}</option>
                {tracks?.map(track => (
                  <option key={track.id} value={track.id}>
                    #{track.number} {track.level}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ))}
        </div>
      </div>

      <div className='flex gap-2'>
        <Button variant='outline' onClick={() => setStep('config')}>
          {loc.no.common.back}
        </Button>
        <Button className='flex-1' onClick={handleSubmit} disabled={!canSubmit}>
          {loc.no.common.continue}
        </Button>
      </div>
    </div>
  )
}
