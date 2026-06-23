import { Combobox, ComboboxMulti } from '@/components/combobox'
import { PageSubheader } from '@/components/PageHeader'
import TournamentPanel from '@/components/tournament/TournamentPanel'
import { TrackRow } from '@/components/track/TrackRow'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import { trackToLookupItem } from '@/lib/lookup-utils'
import type { EliminationType, MatchStage } from '@backend/database/schema'
import type {
  PreviewTournamentRequest,
  TournamentDetails,
  TournamentStageTracksConfig,
} from '@common/models/tournament'
import type { Track } from '@common/models/track'
import {
  combinationValid,
  doubleEliminationReachable,
  snapToValidCombination,
} from '@common/tournament/constraints'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'

const PREVIEW_DEBOUNCE_MS = 380

export default function CreateTournamentPage() {
  const { id: sessionId } = useParams()
  const navigate = useNavigate()
  const { socket } = useConnection()
  const { sessions, tracks, isLoadingData } = useData()
  const { loggedInUser, isLoading } = useAuth()
  const previewSeq = useRef(0)

  const session = sessions?.find(s => s.id === sessionId)
  const participantCount = useMemo(
    () => session?.signups.filter(s => s.response === 'yes').length ?? 0,
    [session]
  )

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [qualificationTrackId, setQualificationTrackId] = useState('')
  const [groupsCount, setGroupsCount] = useState(2)
  const [advancementCount, setAdvancementCount] = useState(2)
  const [eliminationType, setEliminationType] =
    useState<EliminationType>('single')
  const [stageTracks, setStageTracks] = useState<TournamentStageTracksConfig>(
    {}
  )

  const [preview, setPreview] = useState<TournamentDetails | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const canMod = !isLoading && loggedInUser && loggedInUser.role !== 'user'

  const groupsOptions = useMemo(() => {
    if (participantCount < 4) return []
    const opts: number[] = []
    for (let g = 1; g <= participantCount; g++) {
      for (let a = 1; a <= Math.floor(participantCount / g); a++) {
        if (combinationValid(participantCount, g, a, eliminationType)) {
          opts.push(g)
          break
        }
      }
    }
    return [...new Set(opts)].toSorted((a, b) => a - b)
  }, [participantCount, eliminationType])

  const advancementOptions = useMemo(() => {
    const out: number[] = []
    const maxA = Math.floor(participantCount / groupsCount)
    for (let a = 1; a <= maxA; a++) {
      if (combinationValid(participantCount, groupsCount, a, eliminationType)) {
        out.push(a)
      }
    }
    return out
  }, [participantCount, groupsCount, eliminationType])

  const doubleOk = useMemo(
    () => doubleEliminationReachable(participantCount),
    [participantCount]
  )

  const trackList = tracks ?? []

  const qualificationTrack = useMemo(
    () => trackList.find(t => t.id === qualificationTrackId) ?? null,
    [trackList, qualificationTrackId]
  )

  const trackLookupItems = useMemo(
    () => trackList.map(trackToLookupItem),
    [trackList]
  )

  useEffect(() => {
    if (!advancementOptions.includes(advancementCount)) {
      setAdvancementCount(advancementOptions[0] ?? 1)
    }
  }, [advancementOptions, advancementCount])

  useEffect(() => {
    if (trackList.length > 0 && !qualificationTrackId) {
      setQualificationTrackId(trackList[0].id)
    }
  }, [trackList, qualificationTrackId])

  useEffect(() => {
    const sn = snapToValidCombination({
      participantCount,
      groupsCount,
      advancementCount,
      eliminationType,
    })
    setGroupsCount(sn.groupsCount)
    setAdvancementCount(sn.advancementCount)
  }, [eliminationType, participantCount])

  useEffect(() => {
    if (eliminationType === 'double' && !doubleOk) {
      setEliminationType('single')
    }
  }, [doubleOk, eliminationType])

  const runPreview = useCallback(async () => {
    if (!sessionId || participantCount < 4 || !qualificationTrackId) return
    const seq = ++previewSeq.current
    setPreviewLoading(true)
    const req: PreviewTournamentRequest = {
      type: 'PreviewTournamentRequest',
      sessionId,
      name: '…',
      description: null,
      qualificationTrackId,
      groupsCount,
      advancementCount,
      eliminationType,
      stageTracks,
    }
    try {
      const res = await socket.emitWithAck('preview_tournament', req)
      if (seq !== previewSeq.current) return
      if (res.success && 'details' in res) {
        setPreview(res.details)
        const used = res.details.usedStages
        setStageTracks(prev => {
          const next = { ...prev }
          let changed = false
          for (const k of Object.keys(next)) {
            if (!used.includes(k as MatchStage)) {
              delete next[k as MatchStage]
              changed = true
            }
          }
          return changed ? next : prev
        })
      }
    } finally {
      if (seq === previewSeq.current) setPreviewLoading(false)
    }
  }, [
    sessionId,
    participantCount,
    qualificationTrackId,
    groupsCount,
    advancementCount,
    eliminationType,
    stageTracks,
    socket,
  ])

  useEffect(() => {
    if (!sessionId || participantCount < 4) return
    const t = window.setTimeout(() => {
      void runPreview()
    }, PREVIEW_DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [
    sessionId,
    participantCount,
    qualificationTrackId,
    groupsCount,
    advancementCount,
    eliminationType,
    stageTracks,
    runPreview,
  ])

  const allTracksConfigured =
    preview && preview.matches.every(m => m.trackId != null && m.trackId !== '')

  const formValid =
    name.trim().length > 0 &&
    qualificationTrackId &&
    participantCount >= 4 &&
    combinationValid(
      participantCount,
      groupsCount,
      advancementCount,
      eliminationType
    ) &&
    allTracksConfigured &&
    !previewLoading

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!sessionId || !formValid) return
    const res = await socket.emitWithAck('create_tournament', {
      type: 'CreateTournamentRequest',
      sessionId,
      name: name.trim(),
      description: description.trim() || null,
      qualificationTrackId,
      groupsCount,
      advancementCount,
      eliminationType,
      stageTracks,
    })
    if (res.success) {
      toast.success(loc.no.tournament.toast.created)
      navigate(`/sessions/${sessionId}`)
    } else {
      toast.error(res.message)
    }
  }

  if (isLoadingData) {
    return (
      <div className='flex h-dvh items-center justify-center'>
        <Spinner className='size-6' />
      </div>
    )
  }

  if (!session || !sessionId) {
    return (
      <div className='flex flex-col gap-4 p-4'>
        <p>{loc.no.error.messages.not_in_db('session')}</p>
        <Button variant='outline' asChild>
          <Link to='/sessions'>{loc.no.common.back}</Link>
        </Button>
      </div>
    )
  }

  if (session.status === 'cancelled') {
    return (
      <div className='flex flex-col gap-4 p-4'>
        <p>{loc.no.tournament.error.sessionCancelled}</p>
        <Button variant='outline' asChild>
          <Link to={`/sessions/${sessionId}`}>{loc.no.common.back}</Link>
        </Button>
      </div>
    )
  }

  if (!canMod) {
    return (
      <div className='flex flex-col gap-4 p-4'>
        <p>{loc.no.error.messages.insufficient_permissions}</p>
        <Button variant='outline' asChild>
          <Link to={`/sessions/${sessionId}`}>{loc.no.common.back}</Link>
        </Button>
      </div>
    )
  }

  if (participantCount < 4) {
    return (
      <div className='flex flex-col gap-4 p-4'>
        <p>{loc.no.tournament.error.tooFewPlayers}</p>
        <Button variant='outline' asChild>
          <Link to={`/sessions/${sessionId}`}>{loc.no.common.back}</Link>
        </Button>
      </div>
    )
  }

  const usedStages = preview?.usedStages ?? []

  return (
    <div className='flex w-full max-w-none flex-col gap-4 p-4'>
      <PageSubheader
        title={loc.no.tournament.createPageTitle}
        description={session.name}
      />
      <div className='grid min-h-[60vh] grid-cols-1 gap-6 lg:grid-cols-[minmax(280px,340px)_1fr]'>
        <form
          onSubmit={handleSubmit}
          className='bg-background-secondary flex max-h-[calc(100vh-8rem)] flex-col gap-4 overflow-y-auto rounded-sm border p-4 lg:max-h-none'>
          <div>
            <Label htmlFor='tn'>{loc.no.tournament.form.name}</Label>
            <Input
              id='tn'
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className='mt-1'
            />
          </div>
          <div>
            <Label htmlFor='td'>{loc.no.tournament.form.description}</Label>
            <Textarea
              id='td'
              value={description}
              onChange={e => setDescription(e.target.value)}
              className='mt-1'
            />
          </div>
          <div>
            <Label>{loc.no.tournament.form.qualificationTrack}</Label>
            <Combobox
              className='mt-1'
              required
              items={trackLookupItems}
              CustomRow={TrackRow}
              selected={qualificationTrack}
              setSelected={t => setQualificationTrackId(t?.id ?? '')}
              placeholder={loc.no.tournament.form.selectQualificationTrack}
              emptyLabel={loc.no.tournament.form.noTracksFound}
            />
          </div>
          <div>
            <Label>{loc.no.tournament.form.groupsCount}</Label>
            <NativeSelect
              className='mt-1'
              value={String(groupsCount)}
              onChange={e => setGroupsCount(Number(e.target.value))}>
              {groupsOptions.map(g => (
                <option key={g} value={String(g)}>
                  {g}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label>{loc.no.tournament.form.advancementCount}</Label>
            <NativeSelect
              className='mt-1'
              value={String(advancementCount)}
              onChange={e => setAdvancementCount(Number(e.target.value))}>
              {advancementOptions.map(a => (
                <option key={a} value={String(a)}>
                  {a}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label>{loc.no.tournament.form.eliminationType}</Label>
            <NativeSelect
              className='mt-1'
              value={eliminationType}
              onChange={e =>
                setEliminationType(e.target.value as EliminationType)
              }>
              <option value='single'>
                {loc.no.tournament.form.eliminationSingle}
              </option>
              <option value='double' disabled={!doubleOk}>
                {loc.no.tournament.form.eliminationDouble}
              </option>
            </NativeSelect>
          </div>

          {usedStages.length > 0 && (
            <div className='flex flex-col gap-3'>
              <Label>{loc.no.tournament.form.stageTracks}</Label>
              {usedStages.map(st => (
                <StageTrackEditor
                  key={st}
                  stage={st}
                  tracks={trackList}
                  selected={stageTracks[st] ?? []}
                  onChange={list => {
                    setStageTracks(prev => ({ ...prev, [st]: list }))
                  }}
                />
              ))}
            </div>
          )}

          {!allTracksConfigured && preview && (
            <p className='text-destructive text-sm'>
              {loc.no.tournament.form.readiness}
            </p>
          )}

          <Button type='submit' disabled={!formValid}>
            {loc.no.tournament.form.submit}
          </Button>
        </form>

        <div
          className={twMerge(
            'bg-background-secondary border-border relative min-h-[320px] rounded-sm border p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-3rem)] lg:min-w-0 lg:overflow-y-auto'
          )}>
          {previewLoading && (
            <div className='bg-background/80 absolute inset-0 z-10 flex items-center justify-center'>
              <Spinner className='size-8' />
            </div>
          )}
          {preview ? (
            <TournamentPanel details={preview} />
          ) : (
            <p className='text-muted-foreground text-sm'>
              {loc.no.tournament.previewLoading}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function StageTrackEditor({
  stage,
  tracks,
  selected,
  onChange,
}: Readonly<{
  stage: MatchStage
  tracks: Track[]
  selected: string[]
  onChange: (ids: string[]) => void
}>) {
  const items = useMemo(() => tracks.map(trackToLookupItem), [tracks])
  const selectedItems = useMemo(
    () =>
      selected
        .map(id => items.find(i => i.id === id))
        .filter((i): i is (typeof items)[number] => i != null),
    [selected, items]
  )

  return (
    <div className='border-border rounded-sm border p-2'>
      <div className='text-muted-foreground mb-2 text-xs uppercase'>
        {loc.no.match.stage[stage]}
      </div>
      <ComboboxMulti
        className='mt-1'
        items={items}
        CustomRow={TrackRow}
        selected={selectedItems}
        setSelected={next => onChange(next.map(t => t.id))}
        placeholder={loc.no.tournament.form.selectStageTracks}
        emptyLabel={loc.no.tournament.form.noTracksFound}
      />
    </div>
  )
}
