import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { GetLeaderboardRequest } from '../../../common/models/requests'
import {
  type ErrorResponse,
  type GetLeaderboardsResponse,
} from '../../../common/models/responses'
import type { LeaderboardEntry } from '../../../common/models/timeEntry'
import type { Track } from '../../../common/models/track'
import { WS_GET_LEADERBOARD } from '../../../common/utils/constants'
import { formatTrackName } from '../../../common/utils/track'
import { useAuth } from '../../contexts/AuthContext'
import { useConnection } from '../../contexts/ConnectionContext'
import LeaderboardView from '../components/Leaderboard'
import LoadingView from '../components/LoadingView'
import TrackTag from '../components/TrackTag'

export default function Track() {
  const { id } = useParams()
  const { socket } = useConnection()
  const { user } = useAuth()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [track, setTrack] = useState<Track | null>(null)

  useEffect(() => {
    if (!id) return
    socket.emit(
      WS_GET_LEADERBOARD,
      { trackId: id } satisfies GetLeaderboardRequest,
      (r: GetLeaderboardsResponse | ErrorResponse) => {
        if (!r.success) {
          console.error(r.message)
          globalThis.alert(r.message)
          setLoading(false)
          return
        }
        const lb = r.leaderboards[0]
        setEntries(lb.entries)
        setTrack(lb.track)
        setLoading(false)
      }
    )
  }, [id, socket])

  if (loading) return <LoadingView label='Loading leaderboard…' />

  if (!track) throw new Error("Couldn't get track")

  return (
    <div className='grid w-full items-start gap-4 sm:flex sm:justify-center sm:pt-4'>
      <header
        className='bg-background/50 sticky top-0 flex min-w-48 items-center justify-between gap-8 border-b border-white/10 p-4 backdrop-blur-2xl sm:grid sm:border-transparent sm:bg-transparent sm:backdrop-blur-none'
        style={{ top: 'env(safe-area-inset-top, 0px)' }}
      >
        <h1 className={track.level === 'custom' ? 'text-amber-600' : undefined}>
          {formatTrackName(track.number)}
        </h1>
        <div className='flex gap-2'>
          <TrackTag trackLevel={track.level}>{track.level}</TrackTag>
          <TrackTag trackType={track.type}>{track.type}</TrackTag>
        </div>
      </header>

      <section className='w-full px-6 sm:max-w-2xl'>
        <LeaderboardView
          entries={entries}
          className='divide-stroke divide-y'
          highlightedUserId={user?.id}
        />
      </section>
    </div>
  )
}
