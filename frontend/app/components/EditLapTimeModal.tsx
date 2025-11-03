import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { SessionWithSignups } from '../../../common/models/session'
import type { LeaderboardEntry } from '../../../common/models/timeEntry'
import type { Track } from '../../../common/models/track'
import { formatTrackName } from '../../../common/utils/track'
import SearchableDropdown, { type LookupItem } from './SearchableDropdown'

interface EditLapTimeModalProps {
  isOpen: boolean
  lapTime: LeaderboardEntry
  loading: boolean
  onClose: () => void
  tracks?: Track[]
  sessions?: SessionWithSignups[]
  currentTrackId?: string
  currentSessionId?: string | null
  onSubmit: (data: {
    duration?: number | null
    amount?: number
    comment?: string | null
    createdAt?: string
    track?: string
    session?: string | null
  }) => void
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

export default function EditLapTimeModal({
  isOpen,
  lapTime,
  loading,
  onClose,
  tracks,
  sessions,
  currentTrackId,
  currentSessionId,
  onSubmit,
}: Readonly<EditLapTimeModalProps>) {
  const inputs = useRef<HTMLInputElement[]>([])
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', ''])
  const [isDnf, setIsDnf] = useState(false)
  const [amount, setAmount] = useState('0.5')
  const [comment, setComment] = useState('')
  const [createdAtStr, setCreatedAtStr] = useState('')
  const [selectedTrack, setSelectedTrack] = useState<LookupItem | undefined>()
  const [selectedSession, setSelectedSession] = useState<
    LookupItem | undefined
  >()

  const DIGIT = /^\d$/

  // Initialize form from lapTime
  useEffect(() => {
    if (!isOpen) return

    if (lapTime.duration === null) {
      setIsDnf(true)
      setDigits(['', '', '', '', '', ''])
    } else {
      setIsDnf(false)
      const ms = lapTime.duration
      const totalSeconds = Math.floor(ms / 1000)
      const hundredths = Math.floor((ms % 1000) / 10)
      const seconds = totalSeconds % 60
      const minutes = Math.floor(totalSeconds / 60)
      const tenMinutes = Math.floor(minutes / 10)
      const onesMinutes = minutes % 10
      const tenSeconds = Math.floor(seconds / 10)
      const onesSeconds = seconds % 10
      const tenHundredths = Math.floor(hundredths / 10)
      const onesHundredths = hundredths % 10

      setDigits([
        String(tenMinutes),
        String(onesMinutes),
        String(tenSeconds),
        String(onesSeconds),
        String(tenHundredths),
        String(onesHundredths),
      ])
    }

    setAmount(String(lapTime.amount ?? 0.5))
    setComment(lapTime.comment ?? '')

    // Format the creation date to ISO-like format for datetime-local input
    const date = new Date(lapTime.createdAt)
    const isoString = date.toISOString().slice(0, 19)
    setCreatedAtStr(isoString)

    // Initialize track
    if (tracks && currentTrackId) {
      const track = tracks.find(t => t.id === currentTrackId)
      if (track) {
        setSelectedTrack({
          id: track.id,
          label: `${formatTrackName(track.number)} - ${track.type}:${track.level}`,
        })
      }
    }

    // Initialize session
    if (currentSessionId && sessions) {
      const session = sessions.find(s => s.id === currentSessionId)
      if (session) {
        setSelectedSession({ id: session.id, label: session.name })
      }
    } else {
      setSelectedSession(undefined)
    }
  }, [isOpen, lapTime, tracks, sessions, currentTrackId, currentSessionId])

  const setDigitAt = (i: number, val: string) => {
    setDigits(prev => {
      const next = prev.slice()
      next[i] = val
      return next
    })
  }

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    e.preventDefault()

    switch (e.key) {
      case 'ArrowLeft':
        inputs.current[index - 1]?.focus()
        break
      case 'Tab':
      case ' ':
      case 'ArrowRight':
        inputs.current[index + 1]?.focus()
        break
      case 'Backspace':
      case 'Delete':
        setDigitAt(index, '')
        inputs.current[index - 1]?.focus()
        break
      default:
        if (DIGIT.test(e.key)) {
          setDigitAt(index, e.key)
          inputs.current[index + 1]?.focus()
        }
    }
  }

  const getMs = () => {
    if (isDnf) return null

    const tenMinutes = digits[0] === '' ? 0 : Number.parseInt(digits[0]) * 10
    const minutes = digits[1] === '' ? 0 : Number.parseInt(digits[1])

    const tenSeconds = digits[2] === '' ? 0 : Number.parseInt(digits[2]) * 10
    const seconds = digits[3] === '' ? 0 : Number.parseInt(digits[3])

    const tenHundredths = digits[4] === '' ? 0 : Number.parseInt(digits[4]) * 10
    const hundredths = digits[5] === '' ? 0 : Number.parseInt(digits[5])

    const totalMs =
      (tenMinutes + minutes) * 60000 +
      (tenSeconds + seconds) * 1000 +
      (tenHundredths + hundredths) * 10
    return totalMs > 0 ? totalMs : 0
  }

  const isTimeModified = useMemo(() => {
    if (isDnf && lapTime.duration !== null) return true
    if (!isDnf && lapTime.duration === null) return true
    if (!isDnf && lapTime.duration !== null) {
      const currentMs = getMs()
      return currentMs !== lapTime.duration
    }
    return false
  }, [isDnf, digits, lapTime.duration])

  const isModified = useMemo(() => {
    return (
      isTimeModified ||
      Number(amount) !== lapTime.amount ||
      comment !== (lapTime.comment ?? '') ||
      createdAtStr !== new Date(lapTime.createdAt).toISOString().slice(0, 19) ||
      (selectedTrack?.id && selectedTrack.id !== currentTrackId) ||
      selectedSession?.id !== currentSessionId
    )
  }, [
    isTimeModified,
    amount,
    comment,
    createdAtStr,
    lapTime,
    selectedTrack,
    selectedSession,
    currentTrackId,
    currentSessionId,
  ])

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!isModified && !selectedTrack && !selectedSession) return

    const updateData: {
      duration?: number | null
      amount?: number
      comment?: string | null
      createdAt?: string
      track?: string
      session?: string | null
    } = {}

    if (isTimeModified) {
      updateData.duration = isDnf ? null : getMs()
    }
    if (Number(amount) !== lapTime.amount) {
      updateData.amount = Number(amount)
    }
    if (comment !== (lapTime.comment ?? '')) {
      updateData.comment = comment === '' ? null : comment
    }
    if (
      createdAtStr !== new Date(lapTime.createdAt).toISOString().slice(0, 19)
    ) {
      updateData.createdAt = new Date(createdAtStr).toISOString()
    }
    if (selectedTrack?.id && selectedTrack.id !== currentTrackId) {
      updateData.track = selectedTrack.id
    }
    if (selectedSession?.id !== currentSessionId) {
      updateData.session = selectedSession?.id ?? null
    }

    onSubmit(updateData)
  }

  if (!isOpen) return null

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4'>
      <div className='border-stroke w-full max-w-md rounded-2xl border bg-gradient-to-b from-slate-950 to-slate-900 backdrop-blur-xl'>
        <div className='border-b border-white/10 px-6 py-4'>
          <h2 className='text-lg font-semibold'>Edit lap time</h2>
          <p className='text-label-muted text-sm'>
            {lapTime.user.lastName ?? lapTime.user.firstName}
          </p>
        </div>

        <form onSubmit={handleSubmit} className='space-y-4 p-6'>
          {/* Time Input */}
          <div className='space-y-2'>
            <label className='text-sm font-medium'>Duration</label>
            <div className='flex items-center gap-3'>
              <button
                type='button'
                onClick={() => setIsDnf(!isDnf)}
                className='rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium transition hover:bg-white/10'>
                {isDnf ? 'DNF' : 'Time'}
              </button>

              {!isDnf && (
                <div className='flex flex-1 items-center justify-center gap-1'>
                  {digits.map((d, i) => (
                    <span key={i} className='flex items-center gap-1'>
                      <input
                        ref={el => {
                          if (el) inputs.current[i] = el
                        }}
                        value={d}
                        onChange={e => console.debug('Input:', e.target.value)}
                        placeholder='0'
                        onKeyDown={e => handleKeyDown(i, e)}
                        onFocus={e => e.currentTarget.select()}
                        onClick={e => e.currentTarget.select()}
                        className='focus:ring-accent/60 focus:border-accent font-f1-bold h-12 w-12 rounded-lg border border-white/10 bg-white/5 text-center text-xl tabular-nums caret-transparent transition focus:ring-2'
                        inputMode='numeric'
                        pattern={i === 0 || i === 2 ? '[0-5]' : '[0-9]'}
                        maxLength={1}
                      />
                      {i === 1 && <span className='font-f1 text-xl'>:</span>}
                      {i === 3 && <span className='font-f1 text-xl'>.</span>}
                    </span>
                  ))}
                </div>
              )}
              {isDnf && (
                <div className='flex-1 text-center text-lg font-semibold'>
                  DNF
                </div>
              )}
            </div>
          </div>

          {/* Amount */}
          <div className='space-y-2'>
            <label className='text-sm font-medium'>Amount (L)</label>
            <input
              type='number'
              step='0.1'
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className='focus:ring-accent/60 focus:border-accent w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 outline-none transition focus:ring-2'
            />
          </div>

          {/* Comment */}
          <div className='space-y-2'>
            <label className='text-sm font-medium'>Comment</label>
            <input
              type='text'
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder='Optional'
              className='focus:ring-accent/60 focus:border-accent w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 outline-none transition focus:ring-2'
            />
          </div>

          {/* Track */}
          {tracks && tracks.length > 0 && (
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Track</label>
              <SearchableDropdown
                placeholder='Select track'
                selected={selectedTrack}
                setSelected={setSelectedTrack}
                items={
                  tracks.map(t => ({
                    id: t.id,
                    label: `${formatTrackName(t.number)} - ${t.type}:${t.level}`,
                  })) ?? []
                }
              />
            </div>
          )}

          {/* Session */}
          {sessions && sessions.length > 0 && (
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Session (optional)</label>
              <SearchableDropdown
                placeholder='Link to session'
                selected={selectedSession}
                setSelected={setSelectedSession}
                items={
                  sessions.map(s => ({
                    id: s.id,
                    label: s.name,
                  })) ?? []
                }
              />
            </div>
          )}

          {/* Created Date */}
          <div className='space-y-2'>
            <label className='text-sm font-medium'>Created</label>
            <input
              type='datetime-local'
              value={createdAtStr}
              onChange={e => setCreatedAtStr(e.target.value)}
              className='focus:ring-accent/60 focus:border-accent w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 outline-none transition focus:ring-2'
            />
            <p className='text-label-muted text-xs'>
              {lapTime.createdAt &&
                dateFormatter.format(new Date(lapTime.createdAt))}
            </p>
          </div>

          {/* Actions */}
          <div className='flex gap-2 pt-4'>
            <Button
              type='button'
              variant='tertiary'
              onClick={onClose}
              disabled={loading}
              className='flex-1'>
              Cancel
            </Button>
            <Button
              type='submit'
              disabled={loading || !isModified}
              className='flex-1'>
              {loading ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
