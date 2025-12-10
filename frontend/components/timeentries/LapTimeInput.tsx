import Combobox, { type ComboboxLookupItem } from '@/components/combobox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import loc from '@/lib/locales'
import type { SessionWithSignups } from '@common/models/session'
import type {
  CreateTimeEntryRequest,
  EditTimeEntryRequest,
  TimeEntry,
} from '@common/models/timeEntry'
import type { Track } from '@common/models/track'
import type { UserInfo } from '@common/models/user'
import { formatDateWithYear, isOngoing } from '@common/utils/date'
import {
  durationToInputList,
  formatTime,
  inputListToMs,
} from '@common/utils/time'
import { formatTrackName } from '@common/utils/track'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'
import { useAuth } from '../../contexts/AuthContext'
import { useConnection } from '../../contexts/ConnectionContext'
import { useData } from '../../contexts/DataContext'
import { Spinner } from '../ui/spinner'

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

type LapTimeInputProps = {
  editingTimeEntry: Partial<TimeEntry>
  disabled?: boolean
} & ComponentProps<'form'>

function trackToLookupItem(track: Track): ComboboxLookupItem {
  return {
    id: track.id,
    label: '#' + formatTrackName(track.number),
    sublabel: `${track.level} • ${track.type}`,
    tags: [track.level, track.type, track.number.toString()],
  }
}

function sessionToLookupItem(session: SessionWithSignups): ComboboxLookupItem {
  const formattedDate = formatDateWithYear(session.date)
  return {
    id: session.id,
    label: session.name,
    sublabel: formattedDate,
    tags: [session.name, formattedDate, session.status, session.location ?? ''],
  }
}

function userToLookupItem(user: UserInfo): ComboboxLookupItem {
  return {
    id: user.id,
    label: user.lastName ?? user.firstName,
    sublabel: user.shortName ?? undefined,
    tags: [
      user.firstName,
      user.lastName ?? '',
      user.shortName ?? '',
      user.email ?? '',
    ],
  }
}

function getId(path: string) {
  const id = path.split('/').at(-1)
  // Verify that id is a valid UUID (GUID) format, return undefined if not
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return id && uuidRegex.test(id) ? id : undefined
}

export default function LapTimeInput({
  editingTimeEntry,
  onSubmit,
  disabled,
  className,
  ...rest
}: Readonly<LapTimeInputProps>) {
  const { socket } = useConnection()
  const { loggedInUser } = useAuth()
  const { users, tracks, sessions, isLoadingData } = useData()
  const location = useLocation()
  const paramId = getId(location.pathname)

  const currentOngoingSession = sessions
    ? sessions.find(s => isOngoing(s))
    : undefined

  const isCreating = !editingTimeEntry.id
  const loggedInLookup = find(loggedInUser?.id, users)
  const inputs = useRef<HTMLInputElement[]>([])

  const [digits, setDigits] = useState<(typeof cache)['time']>(
    editingTimeEntry.duration
      ? durationToInputList(editingTimeEntry.duration)
      : cache.time
  )
  const [selectedUser, setSelectedUser] = useState(
    find(editingTimeEntry.user ?? paramId, users) ??
      cache.user ??
      loggedInLookup
  )
  const [selectedTrack, setSelectedTrack] = useState(
    find(editingTimeEntry.track ?? paramId, tracks) ?? cache.track
  )

  const [comment, setComment] = useState(editingTimeEntry.comment ?? undefined)

  const [selectedSession, setSelectedSession] = useState<
    ComboboxLookupItem | undefined
  >(
    find(
      editingTimeEntry.id
        ? editingTimeEntry.session
        : (currentOngoingSession?.id ?? paramId),
      sessions
    ) ?? cache.session
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

  function find<T extends Track | UserInfo | SessionWithSignups>(
    id: string | null | undefined,
    records: T[] | undefined
  ): ComboboxLookupItem | undefined {
    if (!id || !records) return undefined
    const item = records.find(r => r.id === id)
    if (!item) return undefined
    if ('level' in item) return trackToLookupItem(item)
    if ('email' in item) return userToLookupItem(item)
    if ('status' in item) return sessionToLookupItem(item)
  }

  useEffect(() => {
    if (!isCreating || selectedUser === paramId) return
    cache.user = selectedUser
  }, [selectedUser])

  useEffect(() => {
    if (!isCreating || selectedTrack === paramId) return
    cache.track = selectedTrack
  }, [selectedTrack])

  useEffect(() => {
    if (!isCreating || selectedSession === paramId) return
    cache.session = selectedSession
  }, [selectedSession])

  if (isLoadingData) {
    return (
      <div className='items-center-safe justify-center-safe flex h-32 w-full'>
        <Spinner className='size-6' />
      </div>
    )
  }

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

  function handleUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!editingTimeEntry?.id) {
      return toast.error('Is not editing')
    }

    const durationInput = inputListToMs(digits)
    const durationToPost = durationInput === 0 ? null : durationInput
    const hasChange =
      selectedUser?.id !== editingTimeEntry.user ||
      selectedTrack?.id !== editingTimeEntry.track ||
      durationToPost !== (editingTimeEntry.duration ?? null) ||
      selectedSession?.id !== (editingTimeEntry.session ?? undefined) ||
      comment !== (editingTimeEntry.comment ?? undefined)

    if (!hasChange) {
      return toast.error(loc.no.timeEntry.input.noChanges)
    }

    const payload = {
      type: 'EditTimeEntryRequest',
      id: editingTimeEntry.id,
      duration: durationToPost,
      user: selectedUser?.id,
      track: selectedTrack?.id,
      session: selectedSession?.id,
      comment: comment?.trim() === '' ? null : comment?.trim(),
    } satisfies EditTimeEntryRequest

    toast.promise(
      socket.emitWithAck('edit_time_entry', payload).then(r => {
        if (!r.success) throw new Error(r.message)
      }),
      loc.no.timeEntry.input.editRequest
    )
  }

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const uid = selectedUser?.id
    const tid = selectedTrack?.id

    if (!uid) {
      return toast.error(loc.no.timeEntry.input.noUser)
    }
    if (!tid) {
      return toast.error(loc.no.timeEntry.input.noTrack)
    }

    const durationInput = inputListToMs(digits)

    const payload = {
      type: 'CreateTimeEntryRequest',
      duration: durationInput === 0 ? null : durationInput,
      user: uid,
      track: tid,
      session: selectedSession?.id,
      comment: comment?.trim() === '' ? undefined : comment?.trim(),
    } satisfies CreateTimeEntryRequest

    toast.promise(
      socket.emitWithAck('post_time_entry', payload).then(r => {
        if (!r.success) throw new Error(r.message)
      }),
      {
        ...loc.no.timeEntry.input.createRequest,
        success: loc.no.timeEntry.input.createRequest.success(
          formatTime(payload.duration ?? 0)
        ),
      }
    )
  }

  // Stable keys for each digit position to avoid using array index as key
  const DIGIT_KEYS = ['m10', 'm1', 's10', 's1', 'h1', 'h10'] as const

  return (
    <form
      className={twMerge('flex flex-col gap-6', className)}
      onSubmit={onSubmit ?? (isCreating ? handleCreate : handleUpdate)}
      {...rest}>
      <div className='flex items-center justify-center gap-1'>
        {digits.map((d, i) => (
          <span key={DIGIT_KEYS[i]} className='flex items-center gap-1'>
            <input
              ref={el => {
                if (el) inputs.current[i] = el
              }}
              disabled={disabled}
              value={d}
              onChange={e => setDigitAt(i, e.target.value)}
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
          {users && (
            <Combobox
              className='w-full'
              required={true}
              disabled={disabled || loggedInUser?.role === 'user'}
              placeholder={loc.no.timeEntry.input.placeholder.user}
              selected={selectedUser}
              setSelected={setSelectedUser}
              align='start'
              items={users.map(userToLookupItem)}
            />
          )}

          {tracks && (
            <Combobox
              className='w-full'
              required={true}
              disabled={disabled}
              placeholder={loc.no.timeEntry.input.placeholder.track}
              selected={selectedTrack}
              setSelected={setSelectedTrack}
              align='end'
              items={tracks.map(trackToLookupItem)}
            />
          )}
        </div>

        {sessions && (
          <Combobox
            className='w-full'
            required={false}
            disabled={disabled}
            placeholder={loc.no.timeEntry.input.placeholder.session}
            selected={selectedSession}
            setSelected={setSelectedSession}
            limit={2}
            items={sessions.map(sessionToLookupItem)}
          />
        )}

        <Label htmlFor='laptime-comment' className='pt-2'>
          {loc.no.timeEntry.input.fieldName.comment}
        </Label>
        <Textarea
          id='laptime-comment'
          name='Comment'
          className='text-sm'
          disabled={disabled}
          onChange={e => setComment(e.target.value)}
          value={comment}
          placeholder={loc.no.timeEntry.input.placeholder.comment}
        />
      </div>
    </form>
  )
}
