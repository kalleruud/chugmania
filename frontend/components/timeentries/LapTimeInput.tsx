import Combobox, { type ComboboxLookupItem } from '@/components/combobox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import loc from '@/lib/locales'
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
import type { SessionWithSignups } from '../../../common/models/session'
import type {
  CreateTimeEntryRequest,
  EditTimeEntryRequest,
  TimeEntry,
} from '../../../common/models/timeEntry'
import type { Track } from '../../../common/models/track'
import type { UserInfo } from '../../../common/models/user'
import {
  durationToInputList,
  formatTime,
  inputListToMs,
} from '../../../common/utils/time'
import { formatTrackName } from '../../../common/utils/track'
import { useAuth } from '../../contexts/AuthContext'
import { useConnection } from '../../contexts/ConnectionContext'
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

type LapTimeInputProps = {
  editingTimeEntry: Partial<TimeEntry>
  disabled?: boolean
} & ComponentProps<'form'>

const dateFormatter = new Intl.DateTimeFormat('nb-NO', {
  dateStyle: 'medium',
})

function trackToLookupItem(track: Track): ComboboxLookupItem {
  return {
    id: track.id,
    label: '#' + formatTrackName(track.number),
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
  const { user: loggedInUser } = useAuth()
  const { users, tracks, sessions } = useData()
  const location = useLocation()
  const paramId = getId(location.pathname)

  const isCreating = !editingTimeEntry.id
  const loggedInLookup = find(loggedInUser?.id, users)
  const inputs = useRef<HTMLInputElement[]>([])

  const [digits, setDigits] = useState<(typeof cache)['time']>(
    durationToInputList(editingTimeEntry.duration) ?? cache.time
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
  >(find(editingTimeEntry.session ?? paramId, sessions) ?? cache.session)

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

  function handleUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!editingTimeEntry?.id) {
      return toast.error('Is not editing')
    }

    const durationInput = inputListToMs(digits)
    const hasChange =
      selectedUser?.id !== editingTimeEntry.user ||
      selectedTrack?.id !== editingTimeEntry.track ||
      durationInput !== (editingTimeEntry.duration ?? 0) ||
      selectedSession?.id !== (editingTimeEntry.session ?? undefined) ||
      comment !== (editingTimeEntry.comment ?? undefined)

    if (!hasChange) {
      return toast.error(loc.no.timeEntry.input.noChanges)
    }

    const payload = {
      type: 'EditTimeEntryRequest',
      id: editingTimeEntry.id,
      duration: durationInput,
      user: selectedUser?.id,
      track: selectedTrack?.id,
      session: selectedSession?.id,
      comment: comment?.trim() === '' ? null : comment?.trim(),
    } satisfies EditTimeEntryRequest

    toast.promise(
      socket.emitWithAck('edit_time_entry', payload),
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
      duration: durationInput,
      user: uid,
      track: tid,
      session: selectedSession?.id,
      comment: comment?.trim() === '' ? undefined : comment?.trim(),
    } satisfies CreateTimeEntryRequest

    toast.promise(socket.emitWithAck('post_time_entry', payload), {
      ...loc.no.timeEntry.input.createRequest,
      success: loc.no.timeEntry.input.createRequest.success(
        formatTime(payload.duration)
      ),
    })
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
              placeholder={loc.no.timeEntry.input.placeholder.user}
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
              placeholder={loc.no.timeEntry.input.placeholder.track}
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
            placeholder={loc.no.timeEntry.input.placeholder.session}
            selected={selectedSession}
            setSelected={setSelectedSession}
            items={Object.values(sessions).map(sessionToLookupItem)}
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
