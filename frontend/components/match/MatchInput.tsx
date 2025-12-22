import { TextField } from '@/components/FormFields'
import Combobox from '@/components/combobox'
import { SessionRow } from '@/components/session/SessionRow'
import { TrackRow } from '@/components/track/TrackRow'
import UserRow from '@/components/user/UserRow'
import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import type { MatchStage } from '@backend/database/schema'
import type {
  CreateMatchRequest,
  EditMatchRequest,
  Match,
  MatchStatus,
} from '@common/models/match'
import type { SessionWithSignups } from '@common/models/session'
import type { Track } from '@common/models/track'
import type { UserInfo } from '@common/models/user'
import { formatDateWithYear, isOngoing } from '@common/utils/date'
import { formatTrackName } from '@common/utils/track'
import { useState, type ComponentProps, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'
import { Label } from '../ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '../ui/select'

type MatchInputProps = {
  editingMatch: Partial<Match>
  onSubmitResponse?: (success: boolean) => void
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void
  disabled?: boolean
} & ComponentProps<'form'>

function trackToLookupItem(track: Track) {
  const trackName = '#' + formatTrackName(track.number)
  return {
    ...track,
    label: trackName,
    sublabel: `${track.level} • ${track.type}`,
    tags: [track.level, track.type, trackName],
  }
}

function sessionToLookupItem(session: SessionWithSignups) {
  const formattedDate = formatDateWithYear(session.date)
  return {
    ...session,
    label: session.name,
    sublabel: formattedDate,
    tags: [session.name, formattedDate, session.status, session.location ?? ''],
    value: session.id,
  }
}

function userToLookupItem(user: UserInfo) {
  return {
    ...user,
    label: user.firstName + (user.lastName ? ' ' + user.lastName : ''),
    sublabel: user.shortName,
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

export default function MatchInput({
  editingMatch,
  onSubmitResponse,
  onSubmit,
  disabled,
  className,
  ...rest
}: Readonly<MatchInputProps>) {
  const { socket } = useConnection()
  const { users, tracks, sessions } = useData()
  const location = useLocation()
  const paramId = getId(location.pathname)

  const isCreating = !editingMatch.id

  const [user1, setUser1] = useState<UserInfo | undefined>(
    users?.find(u => u.id === editingMatch.user1)
  )
  const [user2, setUser2] = useState<UserInfo | undefined>(
    users?.find(u => u.id === editingMatch.user2)
  )
  const [track, setTrack] = useState<Track | undefined>(
    tracks?.find(t => t.id === (editingMatch.track ?? paramId))
  )

  const currentOngoingSession = sessions?.find(s => isOngoing(s))

  const [session, setSession] = useState<SessionWithSignups | undefined>(
    isCreating
      ? (sessions?.find(u => u.id === editingMatch.session) ??
          currentOngoingSession ??
          sessions?.find(u => u.id === paramId))
      : sessions?.find(u => u.id === editingMatch.session)
  )

  const [winner, setWinner] = useState<string | undefined>(
    editingMatch.winner ?? undefined
  )
  const [status, setStatus] = useState<MatchStatus>(
    editingMatch.status ?? 'planned'
  )
  const [stage, setStage] = useState<MatchStage | undefined>(
    editingMatch.stage ?? undefined
  )
  const [comment, setComment] = useState(editingMatch.comment ?? '')

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!track) {
      toast.error(loc.no.match.toast.validationError)
      return
    }

    const payload: CreateMatchRequest = {
      type: 'CreateMatchRequest',
      user1: user1?.id ?? null,
      user2: user2?.id ?? null,
      track: track.id,
      session: session?.id,
      winner: winner === 'none' ? null : winner,
      status: status ?? null,
      stage: stage,
      comment: comment?.trim() === '' ? undefined : comment?.trim(),
    }

    toast.promise(
      socket.emitWithAck('create_match', payload).then(r => {
        onSubmitResponse?.(r.success)
        if (!r.success) throw new Error(r.message)
      }),
      loc.no.match.toast.create
    )
  }

  function handleUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingMatch.id) return

    const payload: EditMatchRequest = {
      type: 'EditMatchRequest',
      id: editingMatch.id,
      user1: user1?.id,
      user2: user2?.id,
      track: track?.id,
      session: session?.id,
      winner: winner === 'none' ? null : (winner ?? null),
      status: status ?? null,
      stage: stage,
      comment: comment?.trim() === '' ? undefined : comment?.trim(),
    }

    toast.promise(
      socket.emitWithAck('edit_match', payload).then(r => {
        onSubmitResponse?.(r.success)
        if (!r.success) throw new Error(r.message)
      }),
      loc.no.match.toast.update
    )
  }

  function handleSetWinner(userId: string) {
    if (!userId || userId === 'none') {
      setWinner('none')
      setStatus('planned')
      return
    }
    setWinner(userId)
    setStatus('completed')
  }

  function handleSetStatus(status: MatchStatus) {
    setStatus(status)
    if (status !== 'completed') {
      setWinner('none')
    }
  }

  return (
    <form
      className={twMerge('flex flex-col gap-6', className)}
      onSubmit={onSubmit ?? (isCreating ? handleCreate : handleUpdate)}
      {...rest}>
      <div className='grid gap-4'>
        <div>
          {users && (
            <Combobox
              className='w-full'
              required
              disabled={disabled}
              selected={user1}
              setSelected={setUser1}
              items={users.map(userToLookupItem)}
              CustomRow={UserRow}
              placeholder={loc.no.match.placeholder.selectUser1}
            />
          )}
        </div>

        <h1 className='font-kh-interface text-center text-2xl font-bold'>
          {loc.no.match.vs}
        </h1>

        <div>
          {users && (
            <Combobox
              className='w-full'
              required
              disabled={disabled}
              selected={user2}
              setSelected={setUser2}
              items={users.map(userToLookupItem)}
              CustomRow={UserRow}
              placeholder={loc.no.match.placeholder.selectUser2}
            />
          )}
        </div>
      </div>

      <div className='grid gap-2'>
        {tracks && (
          <Combobox
            className='w-full'
            required
            disabled={disabled}
            selected={track}
            setSelected={setTrack}
            items={tracks.map(trackToLookupItem)}
            CustomRow={TrackRow}
            placeholder={loc.no.match.placeholder.selectTrack}
          />
        )}
        {sessions && (
          <Combobox
            className='w-full'
            disabled={disabled}
            selected={session}
            setSelected={setSession}
            items={sessions.map(sessionToLookupItem)}
            CustomRow={SessionRow}
            placeholder={loc.no.match.placeholder.selectSession}
          />
        )}
      </div>

      <div className='grid grid-flow-col gap-2'>
        <div className='flex flex-col gap-1'>
          <Label>{loc.no.match.form.stage}</Label>
          <div className='flex items-center gap-2'>
            <Select
              value={stage}
              onValueChange={v => setStage(v as MatchStage)}
              disabled={disabled}>
              <SelectTrigger>
                <SelectValue placeholder={loc.no.match.placeholder.none} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Gruppespill</SelectLabel>
                  <SelectItem value='group'>
                    {loc.no.match.stage.group}
                  </SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Sluttspill</SelectLabel>
                  {Object.entries(loc.no.match.stage)
                    .filter(
                      ([key]) => !key.includes('loser') && key !== 'group'
                    )
                    .map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Tapersluttspill</SelectLabel>
                  {Object.entries(loc.no.match.stage)
                    .filter(([key]) => key.includes('loser'))
                    .map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className='flex flex-col gap-1'>
          <Label>{loc.no.match.form.status}</Label>
          <Select
            value={status}
            onValueChange={handleSetStatus}
            disabled={disabled}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(loc.no.match.status).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='flex flex-col gap-1'>
          <Label>{loc.no.match.form.winner}</Label>
          <Select
            value={winner}
            onValueChange={handleSetWinner}
            disabled={disabled || status !== 'completed'}>
            <SelectTrigger>
              <SelectValue placeholder={loc.no.match.placeholder.none} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='none'>
                {loc.no.match.placeholder.none}
              </SelectItem>
              {user1 && (
                <SelectItem value={user1.id}>{user1.firstName}</SelectItem>
              )}
              {user2 && (
                <SelectItem value={user2.id}>{user2.firstName}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <TextField
        id='comment'
        name={loc.no.match.form.comment}
        value={comment}
        onChange={e => setComment(e.target.value)}
        disabled={disabled}
      />
    </form>
  )
}
