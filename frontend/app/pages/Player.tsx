import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { PlayerDetail } from '../../../common/models/playerDetail'
import type { UpdateUserRequest } from '../../../common/models/requests'
import {
  type ErrorResponse,
  type GetPlayerDetailsResponse,
  type UpdateUserResponse,
} from '../../../common/models/responses'
import type { LeaderboardEntry } from '../../../common/models/timeEntry'
import {
  WS_GET_PLAYER_DETAILS,
  WS_UPDATE_USER,
} from '../../../common/utils/constants'
import { formatTrackName } from '../../../common/utils/track'
import { useAuth } from '../../contexts/AuthContext'
import { useConnection } from '../../contexts/ConnectionContext'
import { Button } from '../components/Button'
import LoadingView from '../components/LoadingView'
import TimeEntryRow from '../components/TimeEntryRow'
import TrackTag from '../components/TrackTag'
import UserForm from '../components/UserForm'

export default function Player() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { socket } = useConnection()
  const { user, refreshUser, requiresEmailUpdate } = useAuth()

  const [detail, setDetail] = useState<PlayerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [formValues, setFormValues] = useState({
    email: '',
    firstName: '',
    lastName: '',
    shortName: '',
    password: '',
  })
  const [formStatus, setFormStatus] = useState<{
    type: 'error' | 'success'
    message: string
  } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!id) {
      setErrorMessage('Missing player identifier')
      setLoading(false)
      return
    }

    socket.emit(
      WS_GET_PLAYER_DETAILS,
      { playerId: id },
      (response: GetPlayerDetailsResponse | ErrorResponse) => {
        if (!response.success) {
          console.error(response.message)
          setErrorMessage(response.message)
          setLoading(false)
          return
        }

        setDetail(response.player)
        setLoading(false)
      }
    )
  }, [id, socket])

  useEffect(() => {
    if (!detail) return
    setFormValues({
      email: detail.user.email,
      firstName: detail.user.firstName ?? '',
      lastName: detail.user.lastName ?? '',
      shortName: detail.user.shortName ?? '',
      password: '',
    })
  }, [detail])

  const totalLaps = useMemo(
    () =>
      detail?.tracks.reduce((sum, track) => sum + track.laps.length, 0) ?? 0,
    [detail]
  )

  if (loading) return <LoadingView />

  if (errorMessage)
    return (
      <div className='mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-12 text-center sm:px-0'>
        <p className='text-label-muted text-sm'>{errorMessage}</p>
        <Button
          type='button'
          variant='tertiary'
          size='sm'
          onClick={() => navigate(-1)}
          className='text-accent mx-auto'>
          Go back
        </Button>
      </div>
    )

  if (!detail)
    return (
      <div className='mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-12 text-center sm:px-0'>
        <p className='text-label-muted text-sm'>Player data unavailable.</p>
      </div>
    )

  const isSelf = user?.id === detail.user.id
  const canEdit = isSelf || user?.role === 'admin'
  const mustUpdateEmail = isSelf && requiresEmailUpdate

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!detail) return

    const trimmedEmail = formValues.email.trim()
    const trimmedFirst = formValues.firstName.trim()
    const trimmedLast = formValues.lastName.trim()
    const trimmedShort = formValues.shortName.trim().toUpperCase()

    const payload: UpdateUserRequest = { userId: detail.user.id }

    if (trimmedEmail && trimmedEmail !== detail.user.email)
      payload.email = trimmedEmail

    if (trimmedFirst !== (detail.user.firstName ?? ''))
      payload.firstName = trimmedFirst

    if (trimmedLast !== (detail.user.lastName ?? ''))
      payload.lastName = trimmedLast

    const currentShort = detail.user.shortName ?? ''
    if (trimmedShort !== currentShort)
      payload.shortName = trimmedShort === '' ? null : trimmedShort

    if (formValues.password) payload.password = formValues.password

    if (Object.keys(payload).length === 1) {
      setFormStatus({ type: 'error', message: 'No changes to update.' })
      return
    }

    setIsSubmitting(true)
    setFormStatus(null)

    socket.emit(
      WS_UPDATE_USER,
      payload,
      (response: UpdateUserResponse | ErrorResponse) => {
        setIsSubmitting(false)
        if (!response.success) {
          setFormStatus({ type: 'error', message: response.message })
          return
        }

        setDetail(prev =>
          prev
            ? {
                ...prev,
                user: response.userInfo,
              }
            : prev
        )
        setFormValues(prev => ({
          ...prev,
          password: '',
        }))
        if (isSelf) refreshUser(response.userInfo, response.token)
        setFormStatus({ type: 'success', message: 'Details updated.' })
      }
    )
  }

  return (
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pb-20 pt-6 sm:px-6 sm:pt-10'>
      <section className='rounded-3xl border border-white/10 bg-black/60 p-6 shadow-[0_20px_80px_-60px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:p-10'>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between'>
          <div className='space-y-1'>
            <h1 className='font-f1-black text-4xl uppercase text-white sm:text-5xl'>
              {detail.user.shortName ?? detail.user.firstName}
            </h1>
            <p className='text-label-secondary text-sm uppercase tracking-[0.2em]'>
              {detail.user.firstName} {detail.user.lastName}
            </p>
          </div>

          <div className='text-label-muted flex gap-6 text-xs uppercase tracking-widest'>
            <div className='text-right'>
              <span className='block text-[0.6rem]'>Tracks</span>
              <span className='font-f1-bold text-xl text-white'>
                {detail.tracks.length}
              </span>
            </div>
            <div className='text-right'>
              <span className='block text-[0.6rem]'>Lap times</span>
              <span className='font-f1-bold text-xl text-white'>
                {totalLaps}
              </span>
            </div>
          </div>
        </div>

        {isSelf && (
          <p className='text-accent/80 mt-3 text-xs uppercase tracking-widest'>
            This is your profile
          </p>
        )}
        {mustUpdateEmail && (
          <p className='text-warning mt-4 text-xs uppercase tracking-widest'>
            Please update your email before continuing.
          </p>
        )}
      </section>

      {canEdit && (
        <section className='rounded-3xl border border-white/10 bg-black/60 p-6 shadow-[0_20px_80px_-60px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:p-10'>
          <h2 className='font-f1-bold text-white'>Edit details</h2>
          <div className='mt-4'>
            <UserForm
              mode='edit'
              email={formValues.email}
              firstName={formValues.firstName}
              lastName={formValues.lastName}
              shortName={formValues.shortName}
              password={formValues.password}
              onEmailChange={email => {
                setFormValues(prev => ({ ...prev, email }))
                setFormStatus(null)
              }}
              onFirstNameChange={firstName => {
                setFormValues(prev => ({ ...prev, firstName }))
                setFormStatus(null)
              }}
              onLastNameChange={lastName => {
                setFormValues(prev => ({ ...prev, lastName }))
                setFormStatus(null)
              }}
              onShortNameChange={shortName => {
                setFormValues(prev => ({ ...prev, shortName }))
                setFormStatus(null)
              }}
              onPasswordChange={password => {
                setFormValues(prev => ({ ...prev, password }))
                setFormStatus(null)
              }}
              onSubmit={onSubmit}
              errorMessage={
                formStatus?.type === 'error' ? formStatus.message : null
              }
              successMessage={
                formStatus?.type === 'success' ? formStatus.message : null
              }
              isSubmitting={isSubmitting}
              submitLabel={isSubmitting ? 'Saving…' : 'Save changes'}
            />
          </div>
        </section>
      )}

      {detail.tracks.length === 0 ? (
        <p className='text-label-muted text-sm'>No lap times recorded yet.</p>
      ) : (
        <div className='flex flex-col gap-4'>
          {detail.tracks.map(trackGroup => {
            const sortedLaps = [...trackGroup.laps].sort((a, b) => {
              const aPos = a.position ?? Number.POSITIVE_INFINITY
              const bPos = b.position ?? Number.POSITIVE_INFINITY
              if (aPos === bPos)
                return (
                  (a.entry.duration ?? Number.POSITIVE_INFINITY) -
                  (b.entry.duration ?? Number.POSITIVE_INFINITY)
                )
              return aPos - bPos
            })

            const leaderboardEntries: LeaderboardEntry[] = sortedLaps.map(
              lap => ({
                id: lap.entry.id,
                duration: lap.entry.duration,
                amount: lap.entry.amount,
                comment: lap.entry.comment ?? null,
                createdAt: new Date(lap.entry.createdAt),
                updatedAt: new Date(lap.entry.updatedAt ?? lap.entry.createdAt),
                deletedAt: lap.entry.deletedAt
                  ? new Date(lap.entry.deletedAt)
                  : null,
                user: detail.user,
                session: null,
                gap: {
                  position: lap.position ?? undefined,
                },
              })
            )

            return (
              <section
                key={trackGroup.track.id}
                className='rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_10px_40px_-30px_rgba(0,0,0,0.9)] sm:p-5'>
                <header className='flex flex-wrap items-baseline justify-between pb-4 sm:pb-4'>
                  <div className='flex flex-col gap-2'>
                    <h1>{formatTrackName(trackGroup.track.number)}</h1>
                    <p className='text-label-secondary text-xs uppercase tracking-widest'>
                      Total entries:{' '}
                      {sortedLaps[0]?.totalEntries ?? trackGroup.laps.length}
                    </p>
                  </div>

                  <div className='flex gap-2'>
                    <TrackTag trackLevel={trackGroup.track.level}>
                      {trackGroup.track.level}
                    </TrackTag>
                    <TrackTag trackType={trackGroup.track.type}>
                      {trackGroup.track.type}
                    </TrackTag>
                  </div>
                </header>

                <table className='flex w-full flex-col'>
                  <tbody className='flex flex-col divide-y divide-white/10'>
                    {sortedLaps.map((lap, index) => {
                      const entry = leaderboardEntries[index]
                      return (
                        <TimeEntryRow
                          key={entry.id}
                          lapTime={entry}
                          position={lap.position ?? undefined}
                          className='py-2'
                          showGap={false}
                          showDate={true}
                          dateValue={entry.createdAt}
                        />
                      )
                    })}
                  </tbody>
                </table>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
