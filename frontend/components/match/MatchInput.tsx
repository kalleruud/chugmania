import { TextField } from '@/components/FormFields'
import Combobox from '@/components/combobox'
import { SessionRow } from '@/components/session/SessionRow'
import { TrackRow } from '@/components/track/TrackRow'
import UserRow from '@/components/user/UserRow'
import { useConnection } from '@/contexts/useConnection'
import { useData } from '@/contexts/useData'
import { useObjectState } from '@/hooks/useObjectState'
import loc from '@/lib/locales'
import {
  getId,
  sessionToLookupItem,
  trackToLookupItem,
  userToLookupItem,
} from '@/lib/lookup-utils'
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
import { isOngoing } from '@common/utils/date'
import type { ComponentProps, SubmitEvent } from 'react'
import { useLocation } from 'react-router'
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
  inputMatch: Partial<Match>
  onSubmitResponse?: (success: boolean) => void
  onSubmit?: (e: SubmitEvent<HTMLFormElement>) => void
  disabled?: boolean
} & ComponentProps<'form'>

export default function MatchInput({
  inputMatch,
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

  const currentOngoingSession = sessions?.find(s => isOngoing(s))

  const isCreating = !inputMatch.id
  const initialUser1: UserInfo | null =
    users?.find(u => u.id === inputMatch.user1) ?? null
  const initialUser2: UserInfo | null =
    users?.find(u => u.id === inputMatch.user2) ?? null
  const initialTrack: Track | null = isCreating
    ? (tracks?.find(t => t.id === (inputMatch.track ?? paramId)) ?? null)
    : (tracks?.find(t => t.id === inputMatch.track) ?? null)
  const initialSession: SessionWithSignups | null = isCreating
    ? (sessions?.find(u => u.id === inputMatch.session) ??
      currentOngoingSession ??
      sessions?.find(u => u.id === paramId) ??
      null)
    : (sessions?.find(u => u.id === inputMatch.session) ?? null)
  const initialWinner: string | null = inputMatch.winner ?? null
  const initialStatus: MatchStatus = inputMatch.status ?? 'planned'
  const initialStage: MatchStage | null = inputMatch.stage ?? null

  const [form, setForm] = useObjectState({
    user1: initialUser1,
    user2: initialUser2,
    track: initialTrack,
    session: initialSession,
    winner: initialWinner,
    status: initialStatus,
    stage: initialStage,
    comment: inputMatch.comment ?? '',
  })
  const { user1, user2, track, session, winner, status, stage, comment } = form

  const request = track
    ? ({
        user1: user1?.id ?? null,
        user2: user2?.id ?? null,
        track: track.id,
        session: session?.id ?? null,
        winner: !winner || winner === 'none' ? null : winner,
        status: status,
        stage: stage ?? null,
        comment: comment.trim() === '' ? null : comment.trim(),
      } satisfies Omit<CreateMatchRequest | EditMatchRequest, 'type'>)
    : undefined

  function handleCreate(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!request) return toast.error(loc.no.match.toast.validationError)

    toast.promise(
      socket
        .emitWithAck('create_match', {
          type: 'CreateMatchRequest',
          ...request,
        })
        .then(r => {
          onSubmitResponse?.(r.success)
          if (!r.success) throw new Error(r.message)
        }),
      loc.no.match.toast.create
    )
  }

  function handleUpdate(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!inputMatch.id) return

    toast.promise(
      socket
        .emitWithAck('edit_match', {
          type: 'EditMatchRequest',
          id: inputMatch.id,
          ...request,
        })
        .then(r => {
          onSubmitResponse?.(r.success)
          if (!r.success) throw new Error(r.message)
        }),
      loc.no.match.toast.update
    )
  }

  function handleSetWinner(userId: string) {
    if (!userId || userId === 'none') {
      setForm({ winner: 'none', status: 'planned' })
      return
    }
    setForm({ winner: userId, status: 'completed' })
  }

  function handleSetStatus(status: MatchStatus) {
    setForm({ status })
    if (status !== 'completed') {
      setForm({ winner: 'none' })
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
              disabled={disabled}
              selected={user1}
              setSelected={value => setForm({ user1: value ?? null })}
              items={users.map(userToLookupItem)}
              CustomRow={UserRow}
              placeholder={loc.no.match.placeholder.selectUser1}
            />
          )}
        </div>

        <h1 className='text-center font-kh-interface text-2xl font-bold'>
          {loc.no.match.vs}
        </h1>

        <div>
          {users && (
            <Combobox
              className='w-full'
              disabled={disabled}
              selected={user2}
              setSelected={value => setForm({ user2: value ?? null })}
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
            setSelected={value => setForm({ track: value ?? null })}
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
            setSelected={value => setForm({ session: value ?? null })}
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
              value={stage ?? undefined}
              onValueChange={v => setForm({ stage: v as MatchStage })}
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
                  {Object.entries(loc.no.match.stage).flatMap(([key, label]) =>
                    !key.includes('loser') && key !== 'group'
                      ? [
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>,
                        ]
                      : []
                  )}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Tapersluttspill</SelectLabel>
                  {Object.entries(loc.no.match.stage).flatMap(([key, label]) =>
                    key.includes('loser')
                      ? [
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>,
                        ]
                      : []
                  )}
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
            value={winner ?? undefined}
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
        onChange={e => setForm({ comment: e.target.value })}
        disabled={disabled}
      />
    </form>
  )
}
