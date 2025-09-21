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
import { useConnection } from '../../contexts/ConnectionContext'
import LeaderboardView from '../components/Leaderboard'
import Spinner from '../components/Spinner'
import TrackTag from '../components/TrackTag'

export default function Track() {
  const { id } = useParams()
  const { socket } = useConnection()
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
          window.alert(r.message)
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

  if (loading)
    return (
      <div className='mt-12 flex w-full items-center justify-center'>
        <Spinner />
      </div>
    )

  if (!track) throw Error("Couldn't get track")

  return (
    <div className='sticky flex w-full gap-6'>
      <section className='flex flex-col gap-2'>
        <h1>{formatTrackName(track?.number)}</h1>
        <div className='flex gap-1'>
          <TrackTag trackLevel={track.level}>{track.level}</TrackTag>
          <TrackTag trackType={track.type}>{track.type}</TrackTag>
        </div>
      </section>

      <section className='flex w-full flex-col gap-4'>
        <LeaderboardView entries={entries} />
      </section>
    </div>
  )
}
