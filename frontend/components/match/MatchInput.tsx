import Combobox from '@/components/combobox'
import { SessionRow } from '@/components/session/SessionRow'
import { TrackRow } from '@/components/track/TrackRow'
import UserRow from '@/components/user/UserRow'
import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import type {
  CreateMatchRequest,
  EditMatchRequest,
  Match,
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

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!user1 || !user2 || !track) {
      toast.error('Please fill in all required fields')
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
      duration: null,
    }

    toast.promise(
      socket.emitWithAck('create_match', payload).then(r => {
        onSubmitResponse?.(r.success)
        if (!r.success) throw new Error(r.message)
      }),
      {
        loading: 'Creating match...',
        success: 'Match created!',
        error: 'Failed to create match',
      }
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
    }

    toast.promise(
      socket.emitWithAck('edit_match', payload).then(r => {
        onSubmitResponse?.(r.success)
        if (!r.success) throw new Error(r.message)
      }),
      {
        loading: 'Updating match...',
        success: 'Match updated!',
        error: 'Failed to update match',
      }
    )
  }

  return (
    <form
      className={twMerge('flex flex-col gap-6', className)}
      onSubmit={onSubmit ?? (isCreating ? handleCreate : handleUpdate)}
      {...rest}>
      <div className='flex gap-4'>
        <div className='flex-1'>
          <Label>User 1</Label>
          {users && (
            <Combobox
              className='w-full'
              required
              disabled={disabled}
              selected={user1}
              setSelected={setUser1}
              items={users.map(userToLookupItem)}
              CustomRow={UserRow}
              placeholder='Select User 1'
            />
          )}
        </div>
        <div className='flex-1'>
          <Label>User 2</Label>
          {users && (
            <Combobox
              className='w-full'
              required
              disabled={disabled}
              selected={user2}
              setSelected={setUser2}
              items={users.map(userToLookupItem)}
              CustomRow={UserRow}
              placeholder='Select User 2'
            />
          )}
        </div>
      </div>

      <div>
        <Label>Track</Label>
        {tracks && (
          <Combobox
            className='w-full'
            required
            disabled={disabled}
            selected={track}
            setSelected={setTrack}
            items={tracks.map(trackToLookupItem)}
            CustomRow={TrackRow}
            placeholder='Select Track'
          />
        )}
      </div>

      <div>
        <Label>Session (Optional)</Label>
        {sessions && (
          <Combobox
            className='w-full'
            disabled={disabled}
            selected={session}
            setSelected={setSession}
            items={sessions.map(sessionToLookupItem)}
            CustomRow={SessionRow}
            placeholder='Select Session'
          />
        )}
      </div>

      <div className='flex gap-4'>
        <div className='flex-1'>
          <Label>Status</Label>
          <Select
            value={status}
            onValueChange={v => setStatus(v as MatchStatus)}
            disabled={disabled}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='planned'>Planned</SelectItem>
              <SelectItem value='completed'>Completed</SelectItem>
              <SelectItem value='cancelled'>Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className='flex-1'>
          <Label>Winner</Label>
          <Select
            value={winner ?? 'none'}
            onValueChange={v => setWinner(v === 'none' ? undefined : v)}
            disabled={disabled || status !== 'completed'}>
            <SelectTrigger>
              <SelectValue placeholder='Select Winner' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='none'>None</SelectItem>
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
