import Combobox, { type ComboboxLookupItem } from '@/components/combobox'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import loc from '@/lib/locales'
import { Plus, Trash2 } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DetailedHTMLProps,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'
import type { PostLapTimeRequest } from '../../../common/models/requests'
import type {
  BackendResponse,
  ErrorResponse,
  GetSessionsResponse,
} from '../../../common/models/responses'
import type { SessionWithSignups } from '../../../common/models/session'
import type { TimeEntry } from '../../../common/models/timeEntry'
import type { Track } from '../../../common/models/track'
import type { UserInfo } from '../../../common/models/user'
import {
  WS_GET_SESSIONS,
  WS_POST_LAPTIME,
} from '../../../common/utils/constants'
import { formattedTimeToMs, formatTime } from '../../../common/utils/time'
import { formatTrackName } from '../../../common/utils/track'
import { useAuth } from '../../contexts/AuthContext'
import { emitAsync, useConnection } from '../../contexts/ConnectionContext'
import { useData } from '../../contexts/DataContext'

const cache: {
  time: string[]
  user: ComboboxLookupItem | undefined
  track: ComboboxLookupItem | undefined
  session: ComboboxLookupItem | undefined
} = {
  time: new Array(6).fill(''),
  user: undefined,
  track: undefined,
  session: undefined,
}

type LapTimeInputProps = DetailedHTMLProps<
  React.FormHTMLAttributes<HTMLFormElement>,
  HTMLFormElement
> & {
  editingTimeEntry: Partial<TimeEntry>
  onSubmitSuccessful?: () => void
}

const dateFormatter = new Intl.DateTimeFormat('nb-NO', {
  dateStyle: 'medium',
})

function trackToLookupItem(track: Track): ComboboxLookupItem {
  return {
    id: track.id,
    label: formatTrackName(track.number),
    sublabel: `${track.level} • ${track.type}`,
    tags: [track.level, track.type, track.number.toString()],
  }
}

function sessionToLookupItem(session: SessionWithSignups): ComboboxLookupItem {
  return {
    id: session.id,
    label: session.name,
    sublabel: dateFormatter.format(new Date(session.date)),
    tags: [session.name, session.location ?? ''],
  }
}

function userToLookupItem(user: UserInfo): ComboboxLookupItem {
  return {
    id: user.id,
    label: user.firstName,
    sublabel: user.shortName ?? user.lastName ?? undefined,
    tags: [
      user.firstName,
      user.lastName ?? '',
      user.shortName ?? '',
      user.email ?? '',
    ].filter(Boolean),
  }
}

export default function LapTimeInput({
  editingTimeEntry,
  onSubmitSuccessful,
  onSubmit,
  className,
}: Readonly<LapTimeInputProps>) {
  const { socket } = useConnection()
  const { user: loggedInUser } = useAuth()
  const { users, tracks } = useData()

  const loggedInLookup = loggedInUser && userToLookupItem(loggedInUser)
  const paramTrack = editingTimeEntry.track
    ? tracks?.[editingTimeEntry.track]
    : undefined

  const inputs = useRef<HTMLInputElement[]>([])
  const commentRef = useRef<HTMLTextAreaElement>(null)

  const [digits, setDigits] = useState<(typeof cache)['time']>(
    toNumberInputList(editingTimeEntry.duration) ?? cache.time
  )
  const [selectedUser, setSelectedUser] = useState(
    find(editingTimeEntry.user, users) ?? cache.user ?? loggedInLookup
  )
  const [selectedTrack, setSelectedTrack] = useState(
    find(editingTimeEntry.track, tracks) ?? cache.track
  )

  const [sessions, setSessions] = useState<SessionWithSignups[] | undefined>(
    undefined
  )

  const [selectedSession, setSelectedSession] = useState(
    find(editingTimeEntry.session, sessions) ?? cache.session
  )

  const DIGIT = /^\d$/

  const setDigitAt = useCallback((i: number, val: string) => {
    setDigits(prev => {
      const next = prev.slice()
      next[i] = val
      return next
    })
    cache.time[i] = val
  }, [])

  const clearDigits = useCallback(() => {
    const empty = new Array(6).fill('')
    cache.time = empty
    setDigits(empty)
  }, [])

  function find<T extends Track | UserInfo | SessionWithSignups>(
    id: string | null | undefined,
    records: Record<string, T> | undefined
  ): ComboboxLookupItem | undefined {
    if (!id || !records || !(id in records)) return undefined
    const item: any = records[id]
    if (item.level) return trackToLookupItem(item)
    if (item.email) return userToLookupItem(item)
    if (item.status) return sessionToLookupItem(item)
  }

  useEffect(() => {
    cache.user = selectedUser
  }, [selectedUser])

  useEffect(() => {
    cache.track = selectedTrack
  }, [selectedTrack])

  useEffect(() => {
    if (paramTrack) cache.track = trackToLookupItem(paramTrack)
  }, [paramTrack])

  useEffect(() => {
    cache.session = selectedSession
  }, [selectedSession])

  function setFocus(i: number) {
    inputs.current[i]?.focus()
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    e.preventDefault()

    switch (e.key) {
      case 'ArrowLeft':
        setFocus(index - 1)
        break
      case 'Tab':
      case ' ':
      case 'ArrowRight':
        setFocus(index + 1)
        break
      case 'Backspace':
      case 'Delete':
        setDigitAt(index, '')
        setFocus(index - 1)
        break
      default:
        if (DIGIT.test(e.key)) {
          setDigitAt(index, e.key)
          setFocus(index + 1)
        }
    }
  }

  useEffect(() => {
    socket.emit(
      WS_GET_SESSIONS,
      undefined,
      (r: GetSessionsResponse | ErrorResponse) => {
        if (!r.success) {
          console.error(r.message)
          return globalThis.alert(r.message)
        }

        setSessions(r.sessions)
        // Pre-select session if sessionId is provided
        if (editingTimeEntry.session && !selectedSession) {
          const session = r.sessions.find(
            s => s.id === editingTimeEntry.session
          )
          if (session) {
            setSelectedSession(sessionToLookupItem(session))
          }
        }
      }
    )
  }, [socket, editingTimeEntry.session, selectedSession, dateFormatter])

  function getMs() {
    const tenMinutes = digits[0] === '' ? 0 : Number.parseInt(digits[0]) * 10
    const minutes = digits[1] === '' ? 0 : Number.parseInt(digits[1])

    const tenSeconds = digits[2] === '' ? 0 : Number.parseInt(digits[2]) * 10
    const seconds = digits[3] === '' ? 0 : Number.parseInt(digits[3])

    const tenHundredths = digits[4] === '' ? 0 : Number.parseInt(digits[4]) * 10
    const hundredths = digits[5] === '' ? 0 : Number.parseInt(digits[5])

    return formattedTimeToMs(
      tenMinutes + minutes,
      tenSeconds + seconds,
      tenHundredths + hundredths
    )
  }

  function toNumberInputList(duration: number): (typeof cache)['time'] {
    // TODO: Implement function
    return
  }

  function isInputValid(): boolean {
    return !!(getMs() > 0 && selectedTrack && selectedUser)
  }

  function handleSubmitResponse(response: BackendResponse) {
    if (!response.success) return
    clearDigits()
    onSubmitSuccessful?.()
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const uid = selectedUser?.id
    const tid = selectedTrack?.id
    if (!uid) {
      return toast.error(loc.no.timeEntryInput.noUser)
    }
    if (!tid) {
      return toast.error(loc.no.timeEntryInput.noTrack)
    }

    onSubmit?.(e)
    const payload = {
      duration: getMs(),
      user: uid,
      track: tid,
      session: selectedSession?.id,
      comment:
        commentRef.current?.value.trim() === ''
          ? undefined
          : commentRef.current?.value.trim(),
      amount: 0.5,
    } satisfies PostLapTimeRequest

    toast.promise(
      emitAsync(socket, WS_POST_LAPTIME, payload, handleSubmitResponse),
      {
        loading: loc.no.timeEntryInput.request.loading,
        success: loc.no.timeEntryInput.request.success(
          formatTime(payload.duration)
        ),
        error: (err: Error) => err.message,
      }
    )
  }

  // Stable keys for each digit position to avoid using array index as key
  const DIGIT_KEYS = ['m10', 'm1', 's10', 's1', 'h1', 'h10'] as const

  return (
    <form
      className={twMerge('flex flex-col gap-6', className)}
      onSubmit={handleSubmit}>
      <div className='flex items-center justify-center gap-1 py-4'>
        {digits.map((d, i) => (
          <span key={DIGIT_KEYS[i]} className='flex items-center gap-1'>
            <input
              ref={el => {
                if (el) inputs.current[i] = el
              }}
              value={d}
              placeholder='0'
              onKeyDown={e => handleKeyDown(i, e)}
              onFocus={e => e.currentTarget.select()}
              onClick={e => e.currentTarget.select()}
              className={
                'focus:ring-ring focus:border-primary border-input bg-background dark:bg-input/30 font-f1-bold h-16 w-12 rounded-md border text-center text-2xl tabular-nums caret-transparent transition selection:bg-transparent invalid:border-red-500/30 invalid:bg-red-500/30'
              }
              inputMode='numeric'
              pattern={i === 0 || i === 2 ? '[0-5]' : '[0-9]'}
              maxLength={1}
            />
            {i === 1 && <span className='font-f1 text-2xl'>:</span>}
            {i === 3 && <span className='font-f1 text-2xl'>.</span>}
          </span>
        ))}
      </div>

      <div className='flex flex-col gap-2'>
        <div className='flex gap-2'>
          {loggedInUser?.role !== 'user' && users && (
            <Combobox
              className='w-full'
              required={true}
              placeholder={loc.no.timeEntryInput.placeholder.user}
              selected={selectedUser}
              setSelected={setSelectedUser}
              align='start'
              items={Object.values(users).map(userToLookupItem)}
            />
          )}

          {tracks && (
            <Combobox
              className='w-full'
              required={true}
              placeholder={loc.no.timeEntryInput.placeholder.track}
              selected={selectedTrack}
              setSelected={setSelectedTrack}
              align='end'
              items={Object.values(tracks).map(trackToLookupItem)}
            />
          )}
        </div>

        {sessions && (
          <Combobox
            className='w-full'
            required={false}
            placeholder={loc.no.timeEntryInput.placeholder.session}
            selected={selectedSession}
            setSelected={setSelectedSession}
            items={sessions?.map(sessionToLookupItem)}
          />
        )}

        <Label htmlFor='laptime-comment'>
          {loc.no.timeEntryInput.fieldName.comment}
        </Label>
        <Textarea
          ref={commentRef}
          id='laptime-comment'
          name='Comment'
          className='text-sm'
          placeholder={loc.no.timeEntryInput.placeholder.comment}
        />
      </div>

      <div className='flex gap-2'>
        <Button variant='destructive'>
          <Trash2 />
          {loc.no.delete}
        </Button>
        <Button type='submit' className='flex-1' disabled={!isInputValid()}>
          <Plus />
          {loc.no.timeEntryInput.submit}
        </Button>
      </div>
    </form>
  )
}
