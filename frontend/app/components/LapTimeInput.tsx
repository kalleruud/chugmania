import Combobox, { type ComboboxLookupItem } from '@/components/combobox'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import loc from '@/lib/locales'
import { Pencil, Plus, Trash2 } from 'lucide-react'
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
import { type PostLapTimeRequest } from '../../../common/models/requests'
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
import {
  durationToInputList,
  formatTime,
  inputListToMs,
} from '../../../common/utils/time'
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
  disabled?: boolean
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
  disabled,
  className,
}: Readonly<LapTimeInputProps>) {
  const { socket } = useConnection()
  const { user: loggedInUser } = useAuth()
  const { users, tracks } = useData()

  const isCreating = !editingTimeEntry.id
  const loggedInLookup = find(loggedInUser?.id, users)
  const inputs = useRef<HTMLInputElement[]>([])

  const [digits, setDigits] = useState<(typeof cache)['time']>(
    durationToInputList(editingTimeEntry.duration) ?? cache.time
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

  const [comment, setComment] = useState(editingTimeEntry.comment ?? undefined)

  const [selectedSession, setSelectedSession] = useState<
    ComboboxLookupItem | undefined
  >(cache.session)

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
    if (!isCreating) return
    cache.user = selectedUser
  }, [selectedUser])

  useEffect(() => {
    if (!isCreating) return
    cache.track = selectedTrack
  }, [selectedTrack])

  useEffect(() => {
    if (!isCreating) return
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

  function isInputValid(): boolean {
    return !!(inputListToMs(digits) > 0 && selectedTrack && selectedUser)
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
      duration: inputListToMs(digits),
      user: uid,
      track: tid,
      session: selectedSession?.id,
      comment: comment?.trim() === '' ? undefined : comment?.trim(),
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
              disabled={disabled}
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
              disabled={disabled}
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
              disabled={disabled}
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
            disabled={disabled}
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
          id='laptime-comment'
          name='Comment'
          className='text-sm'
          disabled={disabled}
          onChange={e => setComment(e.target.value)}
          value={comment}
          placeholder={loc.no.timeEntryInput.placeholder.comment}
        />
      </div>

      {!disabled && (
        <div className='flex gap-2'>
          <Button variant='destructive'>
            <Trash2 />
            {loc.no.delete}
          </Button>
          <Button type='submit' className='flex-1' disabled={!isInputValid()}>
            {isCreating ? <Plus /> : <Pencil />}
            {isCreating
              ? loc.no.timeEntryInput.submit
              : loc.no.timeEntryInput.update}
          </Button>
        </div>
      )}
    </form>
  )
}
