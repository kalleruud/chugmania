import { TextField } from '@/components/FormFields'
import Combobox from '@/components/combobox'
import { SessionRow } from '@/components/session/SessionRow'
import { TrackRow } from '@/components/track/TrackRow'
import UserRow from '@/components/user/UserRow'
import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import type {
  CreateMatchRequest,
  EditMatchRequest,
  Match,
  MatchStage,
  MatchStatus,
} from '@common/models/match'
import type { SessionWithSignups } from '@common/models/session'
import type { Track } from '@common/models/track'
import type { UserInfo } from '@common/models/user'
import { formatDateWithYear } from '@common/utils/date'
import { formatTrackName } from '@common/utils/track'
import { useState, type ComponentProps, type FormEvent } from 'react'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'
import { Label } from '../ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
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
  const { loggedInUser } = useAuth()

  const isCreating = !editingMatch.id

  const [user1, setUser1] = useState<UserInfo | undefined>(
    users?.find(u => u.id === editingMatch.user1) ?? loggedInUser
  )
  const [user2, setUser2] = useState<UserInfo | undefined>(
    users?.find(u => u.id === editingMatch.user2)
  )
  const [track, setTrack] = useState<Track | undefined>(
    tracks?.find(t => t.id === editingMatch.track)
  )
  const [session, setSession] = useState<SessionWithSignups | undefined>(
    sessions?.find(s => s.id === editingMatch.session)
  )
  const [winner, setWinner] = useState<string | undefined>(
    editingMatch.winner ?? undefined
  )
  const [status, setStatus] = useState<MatchStatus>(
    (editingMatch.status as MatchStatus) ?? 'planned'
  )
  const [stage, setStage] = useState<MatchStage>(
    (editingMatch.stage as MatchStage) ?? 'group'
  )
  const [comment, setComment] = useState(editingMatch.comment ?? '')

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!user1 || !user2 || !track) {
      toast.error(loc.no.match.toast.validationError)
      return
    }

    const payload: CreateMatchRequest = {
      type: 'CreateMatchRequest',
      user1: user1.id,
      user2: user2.id,
      track: track.id,
      session: session?.id,
      winner: winner,
      status: status,
      stage: stage,
      comment: comment,
      duration: null,
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
      winner: winner,
      status: status,
      stage: stage,
      comment: comment,
    }

    toast.promise(
      socket.emitWithAck('edit_match', payload).then(r => {
        onSubmitResponse?.(r.success)
        if (!r.success) throw new Error(r.message)
      }),
      loc.no.match.toast.update
    )
  }

  return (
    <form
      className={twMerge('flex flex-col gap-6', className)}
      onSubmit={onSubmit ?? (isCreating ? handleCreate : handleUpdate)}
      {...rest}>
      <div className='flex gap-4'>
        <div className='flex-1'>
          <Label>{loc.no.match.form.user1}</Label>
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
        <div className='flex-1'>
          <Label>{loc.no.match.form.user2}</Label>
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

      <div>
        <Label>{loc.no.match.form.track}</Label>
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
      </div>

      <div>
        <Label>{loc.no.match.form.session}</Label>
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

      <div className='flex gap-4'>
        <div className='flex-1'>
          <Label>{loc.no.match.form.stage}</Label>
          <Select
            value={stage}
            onValueChange={v => setStage(v as MatchStage)}
            disabled={disabled}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(loc.no.match.stage).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
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

      <div className='flex gap-4'>
        <div className='flex-1'>
          <Label>{loc.no.match.form.status}</Label>
          <Select
            value={status}
            onValueChange={v => setStatus(v as MatchStatus)}
            disabled={disabled}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='planned'>
                {loc.no.match.status.planned}
              </SelectItem>
              <SelectItem value='completed'>
                {loc.no.match.status.completed}
              </SelectItem>
              <SelectItem value='cancelled'>
                {loc.no.match.status.cancelled}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className='flex-1'>
          <Label>{loc.no.match.form.winner}</Label>
          <Select
            value={winner ?? 'none'}
            onValueChange={v => setWinner(v === 'none' ? undefined : v)}
            disabled={disabled || status !== 'completed'}>
            <SelectTrigger>
              <SelectValue
                placeholder={loc.no.match.placeholder.selectWinner}
              />
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
    </form>
  )
}
