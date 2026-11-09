import Combobox from '@/components/combobox'
import {
  getId,
  sessionToLookupItem,
  trackToLookupItem,
  userToLookupItem,
} from '@/lib/lookup-utils'
import loc from '@common/locale/locales'
import type { TimeEntryDraft } from '@common/models/resultDraft'
import type { SessionWithSignups } from '@common/models/session'
import type { TimeEntry } from '@common/models/timeEntry'
import type { Track } from '@common/models/track'
import type { UserInfo } from '@common/models/user'
import { isOngoing } from '@common/utils/date'
import {
  durationToInputList,
  formatTime,
  inputListToMs,
} from '@common/utils/time'
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/solid'
import {
  useRef,
  useState,
  type ComponentProps,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
  type SubmitEvent,
} from 'react'
import { useLocation } from 'react-router'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'
import { useAuth } from '../../contexts/AuthContext'
import { useConnection } from '../../contexts/ConnectionContext'
import { useData } from '../../contexts/DataContext'
import { TextField } from '../FormFields'
import { SessionRow } from '../session/SessionRow'
import { TrackRow } from '../track/TrackRow'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { Spinner } from '../ui/spinner'
import UserRow from '../user/UserRow'

// Stable keys for each digit position to avoid using array index as key
const DIGIT_KEYS = ['m10', 'm1', 's10', 's1', 'ms100', 'ms10', 'ms1'] as const
const DIGIT = /^\d$/

function DurationInput({
  label,
  digits,
  setDigits,
  disabled,
  small,
}: Readonly<{
  label: string
  digits: string[]
  setDigits: Dispatch<SetStateAction<string[]>>
  disabled?: boolean
  small?: boolean
}>) {
  const inputs = useRef<HTMLInputElement[]>([])

  function setDigitAt(i: number, val: string) {
    setDigits(prev => {
      const next = prev.slice()
      next[i] = val
      return next
    })
  }

  function setFocus(i: number) {
    inputs.current[i]?.focus()
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Tab') return

    e.preventDefault()
    switch (e.key) {
      case 'ArrowLeft':
        setFocus(index - 1)
        break
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

  const separator = twMerge('font-f1', small ? 'text-lg' : 'text-2xl')

  return (
    <div className='flex items-center justify-center gap-1'>
      {digits.map((d, i) => (
        <span key={DIGIT_KEYS[i]} className='flex items-center gap-1'>
          <input
            ref={el => {
              if (el) inputs.current[i] = el
            }}
            disabled={disabled}
            aria-label={`${label} ${i + 1}`}
            value={d}
            onChange={e => setDigitAt(i, e.target.value)}
            placeholder='0'
            onKeyDown={e => handleKeyDown(i, e)}
            onFocus={e => e.currentTarget.select()}
            onClick={e => e.currentTarget.select()}
            className={twMerge(
              'font-f1-bold rounded-md border border-input bg-background text-center text-2xl tabular-nums caret-transparent transition selection:bg-transparent invalid:border-red-500/30 invalid:bg-red-500/30 focus:border-primary focus:ring-ring dark:bg-input/30',
              small ? 'h-10 w-7 text-lg sm:w-8' : 'h-16 w-8 sm:w-10'
            )}
            inputMode='numeric'
            pattern={i === 0 || i === 2 ? '[0-5]' : '[0-9]'}
            maxLength={1}
          />
          {i === 1 && <span className={separator}>:</span>}
          {i === 3 && <span className={separator}>.</span>}
        </span>
      ))}
    </div>
  )
}

type LapTimeInputProps = {
  inputTimeEntry: Partial<TimeEntryDraft>
  onSubmitResponse?: (success: boolean) => void
  disabled?: boolean
} & ComponentProps<'form'>

export default function TimeEntryInput({
  inputTimeEntry,
  onSubmitResponse,
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

  const currentOngoingSession = sessions?.find(s => isOngoing(s))

  const isCreating = !inputTimeEntry.id

  const initialUser: UserInfo | null = isCreating
    ? (users?.find(u => u.id === (inputTimeEntry.user ?? paramId)) ??
      loggedInUser ??
      null)
    : (users?.find(u => u.id === inputTimeEntry.user) ??
      (loggedInUser?.role === 'user' ? loggedInUser : null))
  const initialTrack: Track | null = isCreating
    ? (tracks?.find(t => t.id === (inputTimeEntry.track ?? paramId)) ?? null)
    : (tracks?.find(t => t.id === inputTimeEntry.track) ?? null)
  const initialSession: SessionWithSignups | null = isCreating
    ? (sessions?.find(u => u.id === inputTimeEntry.session) ??
      currentOngoingSession ??
      sessions?.find(u => u.id === paramId) ??
      null)
    : (sessions?.find(u => u.id === inputTimeEntry.session) ?? null)

  const [digits, setDigits] = useState<string[]>(
    durationToInputList(inputTimeEntry.duration)
  )
  const [showChug, setShowChug] = useState(
    inputTimeEntry.chugDurationMs !== null &&
      inputTimeEntry.chugDurationMs !== undefined
  )
  const [chugDigits, setChugDigits] = useState<string[]>(
    durationToInputList(inputTimeEntry.chugDurationMs)
  )

  const [selectedUser, setSelectedUser] = useState(initialUser)
  const [selectedTrack, setSelectedTrack] = useState(initialTrack)
  const [selectedSession, setSelectedSession] = useState(initialSession)
  const [comment, setComment] = useState(inputTimeEntry.comment ?? '')
  const [status, setStatus] = useState<TimeEntry['status']>(
    inputTimeEntry.status ?? 'completed'
  )
  const hasDuration = inputListToMs(digits) > 0
  const isDraft = inputTimeEntry.publicationState === 'draft'
  const effectiveStatus = !isDraft && hasDuration ? 'completed' : status
  const isModerator = !!loggedInUser && loggedInUser.role !== 'user'

  function handleSetStatus(value: string) {
    if (value === 'planned' || value === 'completed' || value === 'cancelled')
      setStatus(value)
  }

  const durationInput = inputListToMs(digits)
  const request = {
    duration: durationInput === 0 ? null : durationInput,
    chugDurationMs: showChug ? inputListToMs(chugDigits) : null,
    status: effectiveStatus,
    user: selectedUser?.id ?? null,
    track: selectedTrack?.id ?? null,
    session: selectedSession?.id ?? null,
    comment: comment.trim() === '' ? null : comment.trim(),
  }

  if (isLoadingData) {
    return (
      <div className='flex h-32 w-full items-center-safe justify-center-safe'>
        <Spinner className='size-6' />
      </div>
    )
  }

  function handleUpdate(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const id = inputTimeEntry.id
    if (!id) return toast.error('Is not editing')
    if (
      inputTimeEntry.tieBreaker &&
      request.status === 'completed' &&
      !request.duration
    )
      return toast.error(loc.no.timeEntry.input.validationError)
    const publish = isDraft && request.status === 'completed'

    toast.promise(
      socket
        .emitWithAck('edit_time_entry', {
          type: 'EditTimeEntryRequest',
          id,
          ...request,
        })
        .then(r =>
          r.success && publish
            ? socket.emitWithAck('publish_result_draft', { kind: 'lap', id })
            : r
        )
        .then(r => {
          onSubmitResponse?.(r.success)
          if (!r.success) throw new Error(r.message)
        }),
      publish
        ? loc.no.resultDraft.publishRequest
        : loc.no.timeEntry.input.editRequest
    )
  }

  function handleCreate(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const { user, track } = request
    if (!user || !track)
      return toast.error(loc.no.timeEntry.input.validationError)

    toast.promise(
      socket
        .emitWithAck('post_time_entry', {
          type: 'CreateTimeEntryRequest',
          ...request,
          user,
          track,
        })
        .then(r => {
          onSubmitResponse?.(r.success)
          if (!r.success) throw new Error(r.message)
        }),
      {
        ...loc.no.timeEntry.input.createRequest,
        success: loc.no.timeEntry.input.createRequest.success(
          request.duration ? formatTime(request.duration) : loc.no.timeEntry.dnf
        ),
      }
    )
  }

  return (
    <form
      className={twMerge('flex flex-col gap-6', className)}
      onSubmit={onSubmit ?? (isCreating ? handleCreate : handleUpdate)}
      {...rest}>
      <div className='flex flex-col items-center gap-2'>
        <DurationInput
          label='Siffer'
          digits={digits}
          setDigits={setDigits}
          disabled={disabled}
        />
        {showChug ? (
          <fieldset className='min-w-0'>
            <legend className='mb-1 w-full text-center text-sm text-muted-foreground'>
              {loc.no.timeEntry.input.chug}
            </legend>
            <div className='relative'>
              <DurationInput
                small
                label={loc.no.timeEntry.input.chug}
                digits={chugDigits}
                setDigits={setChugDigits}
                disabled={disabled}
              />
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='absolute top-1/2 left-full ml-1 -translate-y-1/2'
                aria-label={loc.no.timeEntry.input.removeChug}
                disabled={disabled}
                onClick={() => {
                  setShowChug(false)
                  setChugDigits(durationToInputList(null))
                }}>
                <XMarkIcon />
              </Button>
            </div>
          </fieldset>
        ) : (
          <Button
            type='button'
            variant='ghost'
            size='sm'
            className='text-muted-foreground'
            disabled={disabled}
            onClick={() => setShowChug(true)}>
            <PlusIcon />
            {loc.no.timeEntry.input.chug}
          </Button>
        )}
      </div>

      <div className='flex flex-col gap-2'>
        <Combobox
          className='w-full'
          required={true}
          disabled={
            disabled ||
            inputTimeEntry.tieBreaker ||
            loggedInUser?.role === 'user'
          }
          placeholder={loc.no.timeEntry.input.placeholder.user}
          selected={selectedUser}
          setSelected={value => setSelectedUser(value ?? null)}
          limit={4}
          align='start'
          items={users.map(userToLookupItem)}
          CustomRow={props => <UserRow {...props} hideRanking />}
        />

        <Combobox
          className='w-full'
          required={true}
          disabled={disabled || inputTimeEntry.tieBreaker || isDraft}
          placeholder={loc.no.timeEntry.input.placeholder.track}
          selected={selectedTrack}
          setSelected={value => setSelectedTrack(value ?? null)}
          limit={4}
          align='start'
          items={tracks.map(trackToLookupItem)}
          CustomRow={TrackRow}
        />

        <Combobox
          className='w-full'
          required={false}
          disabled={disabled || inputTimeEntry.tieBreaker}
          placeholder={loc.no.timeEntry.input.placeholder.session}
          selected={selectedSession}
          setSelected={value => setSelectedSession(value ?? null)}
          limit={4}
          align='start'
          items={sessions
            .filter(s => s.status !== 'cancelled')
            .map(sessionToLookupItem)}
          CustomRow={SessionRow}
        />

        {(isModerator || isDraft) && (
          <div className='flex flex-col gap-1'>
            <Label htmlFor='time-entry-status'>
              {loc.no.match.form.status}
            </Label>
            <Select
              value={effectiveStatus}
              onValueChange={handleSetStatus}
              disabled={disabled || (!isDraft && hasDuration)}>
              <SelectTrigger id='time-entry-status'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(loc.no.common.status).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <TextField
          id='comment'
          name='Comment'
          disabled={disabled}
          onChange={e => setComment(e.target.value)}
          value={comment}
          placeholder={loc.no.timeEntry.input.placeholder.comment}
        />
      </div>
    </form>
  )
}
