import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { PlayerDetail } from '../../../common/models/playerDetail'
import {
  type ErrorResponse,
  type GetPlayerDetailsResponse,
} from '../../../common/models/responses'
import { formatTime } from '../../../common/utils/time'
import { formatTrackName } from '../../../common/utils/track'
import { WS_GET_PLAYER_DETAILS } from '../../../common/utils/constants'
import { useAuth } from '../../contexts/AuthContext'
import { useConnection } from '../../contexts/ConnectionContext'
import LoadingView from '../components/Loading'
import TrackTag from '../components/TrackTag'
import { Button } from '../components/Button'

function formatDuration(duration: number | null) {
  if (duration == null) return 'DNF'
  return formatTime(duration)
}

function formatPosition(position: number | null, total: number) {
  if (position == null) return `DNF · ${total}`
  return `#${position} · ${total}`
}

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
          className='mx-auto text-accent'
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

          <div className='flex gap-6 text-xs uppercase tracking-widest text-label-muted'>
            <div className='text-right'>
              <span className='block text-[0.6rem]'>Tracks</span>
              <span className='font-f1-bold text-xl text-white'>
                {detail.tracks.length}
              </span>
            </div>
            <div className='text-right'>
              <span className='block text-[0.6rem]'>Lap times</span>
              <span className='font-f1-bold text-xl text-white'>{totalLaps}</span>
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
            const bestPosition = trackGroup.laps
              .map(lap => lap.position ?? Number.POSITIVE_INFINITY)
              .reduce((best, position) => Math.min(best, position), Number.POSITIVE_INFINITY)

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
                      Total entries: {trackGroup.laps[0]?.totalEntries ?? trackGroup.laps.length}
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

                <ul className='space-y-2'>
                  {trackGroup.laps.map(lap => {
                    const isBest =
                      lap.position != null && lap.position === bestPosition

                    return (
                      <li
                        key={lap.entry.id}
                        className='flex flex-col gap-3 rounded-xl border border-white/10 bg-black/40 p-4 text-sm sm:flex-row sm:items-center sm:justify-between'
                      >
                        <div className='flex items-center gap-4'>
                          <span
                            className={
                              'font-f1-bold text-lg uppercase' +
                              (isBest ? ' text-accent' : ' text-white')
                            }
                          >
                            {formatDuration(lap.entry.duration)}
                          </span>
                          <span className='text-label-secondary text-xs uppercase tracking-widest'>
                            {formatPosition(lap.position, lap.totalEntries)}
                          </span>
                        </div>

                        <div className='flex flex-1 flex-col gap-1 sm:items-end sm:text-right'>
                          {lap.entry.comment && (
                            <p className='text-label-muted text-xs italic'>
                              “{lap.entry.comment}”
                            </p>
                          )}
                          <span className='text-label-muted text-[0.65rem] uppercase tracking-[0.3em]'>
                            {lap.entry.createdAt.toLocaleString()}
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
