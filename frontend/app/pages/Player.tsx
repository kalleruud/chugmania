import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { PlayerDetail } from '../../../common/models/playerDetail'
import {
  type ErrorResponse,
  type GetPlayerDetailsResponse,
} from '../../../common/models/responses'
import type { LeaderboardEntry } from '../../../common/models/timeEntry'
import { WS_GET_PLAYER_DETAILS } from '../../../common/utils/constants'
import { formatTrackName } from '../../../common/utils/track'
import { useAuth } from '../../contexts/AuthContext'
import { useConnection } from '../../contexts/ConnectionContext'
import { Button } from '../components/Button'
import LoadingView from '../components/Loading'
import TimeEntryRow from '../components/TimeEntryRow'
import TrackTag from '../components/TrackTag'

export default function Player() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { socket } = useConnection()
  const { user } = useAuth()

  const [detail, setDetail] = useState<PlayerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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
          className='text-accent mx-auto'
        >
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
      </section>

      {detail.tracks.length === 0 ? (
        <p className='text-label-muted text-sm'>No lap times recorded yet.</p>
      ) : (
        <div className='flex flex-col gap-6'>
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

            const bestPosition = sortedLaps.reduce((best, lap) => {
              const position = lap.position ?? Number.POSITIVE_INFINITY
              return Math.min(best, position)
            }, Number.POSITIVE_INFINITY)

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
                gap: {
                  position: lap.position ?? undefined,
                },
              })
            )

            return (
              <section
                key={trackGroup.track.id}
                className='rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_10px_40px_-30px_rgba(0,0,0,0.9)]'
              >
                <header className='flex flex-wrap items-center justify-between gap-3 pb-4'>
                  <div>
                    <h2 className='font-f1 text-2xl uppercase text-white'>
                      {formatTrackName(trackGroup.track.number)}
                    </h2>
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

                <table className='flex w-full flex-col gap-2'>
                  <tbody className='flex flex-col gap-2'>
                    {sortedLaps.map((lap, index) => {
                      const entry = leaderboardEntries[index]
                      const isBest =
                        lap.position != null && lap.position === bestPosition

                      return (
                        <TimeEntryRow
                          key={entry.id}
                          lapTime={entry}
                          position={lap.position ?? undefined}
                          className={`rounded-xl border border-white/10 bg-black/40 px-4 py-3 ${
                            isBest ? 'border-accent/50' : ''
                          }`}
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
