import Combobox from '@/components/combobox'
import DurationInput from '@/components/timeentries/DurationInput'
import {
  getId,
  sessionToLookupItem,
  trackToLookupItem,
  userToLookupItem,
} from '@/lib/lookup-utils'
import loc from '@common/locale/locales'
import type { SessionWithSignups } from '@common/models/session'
import type {
  CreateTimeEntryRequest,
  EditTimeEntryRequest,
  TimeEntry,
} from '@common/models/timeEntry'
import type { Track } from '@common/models/track'
import type { UserInfo } from '@common/models/user'
import { isOngoing } from '@common/utils/date'
import {
  durationToInputList,
  formatTime,
  inputListToMs,
} from '@common/utils/time'
import { useMemo, useState, type ComponentProps, type SubmitEvent } from 'react'
import { useLocation } from 'react-router'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'
import { useAuth } from '../../contexts/AuthContext'
import { useConnection } from '../../contexts/ConnectionContext'
import { useData } from '../../contexts/DataContext'
import { TextField } from '../FormFields'
import { SessionRow } from '../session/SessionRow'
import { TrackRow } from '../track/TrackRow'
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

type LapTimeInputProps = {
  inputTimeEntry: Partial<TimeEntry>
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
    : (users?.find(u => u.id === inputTimeEntry.user) ?? null)
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

  const [selectedUser, setSelectedUser] = useState(initialUser)
  const [selectedTrack, setSelectedTrack] = useState(initialTrack)
  const [selectedSession, setSelectedSession] = useState(initialSession)
  const [comment, setComment] = useState(inputTimeEntry.comment ?? '')
  const [status, setStatus] = useState<TimeEntry['status']>(
    inputTimeEntry.status ?? 'completed'
  )
  const hasDuration = inputListToMs(digits) > 0
  const effectiveStatus = hasDuration ? 'completed' : status
  const isModerator = !!loggedInUser && loggedInUser.role !== 'user'

  function handleSetStatus(value: string) {
    if (value === 'planned' || value === 'completed' || value === 'cancelled')
      setStatus(value)
  }

  const request = useMemo(() => {
    if (!selectedUser?.id || !selectedTrack?.id) return undefined
    const durationInput = inputListToMs(digits)
    const durationToPost = durationInput === 0 ? null : durationInput

    return {
      duration: durationToPost,
      status: effectiveStatus,
      user: selectedUser.id,
      track: selectedTrack.id,
      session: selectedSession?.id ?? null,
      comment: comment.trim() === '' ? null : comment.trim(),
    } satisfies
      | Omit<CreateTimeEntryRequest | EditTimeEntryRequest, 'type'>
      | undefined
  }, [
    selectedUser,
    selectedTrack,
    selectedSession,
    isCreating,
    digits,
    comment,
    effectiveStatus,
  ])

  if (isLoadingData) {
    return (
      <div className='flex h-32 w-full items-center-safe justify-center-safe'>
        <Spinner className='size-6' />
      </div>
    )
  }

  function handleUpdate(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!inputTimeEntry.id) return toast.error('Is not editing')
    if (
      !request ||
      (inputTimeEntry.tieBreaker &&
        request.status === 'completed' &&
        !request.duration)
    )
      return toast.error(loc.no.timeEntry.input.validationError)

    toast.promise(
      socket
        .emitWithAck('edit_time_entry', {
          type: 'EditTimeEntryRequest',
          id: inputTimeEntry.id,
          ...request,
        })
        .then(r => {
          onSubmitResponse?.(r.success)
          if (!r.success) throw new Error(r.message)
        }),
      loc.no.timeEntry.input.editRequest
    )
  }

  function handleCreate(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!request) return toast.error(loc.no.timeEntry.input.validationError)

    toast.promise(
      socket
        .emitWithAck('post_time_entry', {
          type: 'CreateTimeEntryRequest',
          ...request,
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
      <DurationInput
        label='Rundetid'
        digits={digits}
        onChange={setDigits}
        disabled={disabled}
      />

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
          disabled={disabled || inputTimeEntry.tieBreaker}
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

        {isModerator && (
          <div className='flex flex-col gap-1'>
            <Label htmlFor='time-entry-status'>
              {loc.no.match.form.status}
            </Label>
            <Select
              value={effectiveStatus}
              onValueChange={handleSetStatus}
              disabled={disabled || hasDuration}>
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
