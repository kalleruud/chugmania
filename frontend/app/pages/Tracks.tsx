import { useEffect, useState } from 'react'
import type { Leaderboard } from '../../../common/models/leaderboard'
import {
  type ErrorResponse,
  type GetLeaderboardsResponse,
} from '../../../common/models/responses'
import { WS_GET_LEADERBOARD_SUMMARIES } from '../../../common/utils/constants'
import { useConnection } from '../../contexts/ConnectionContext'
import LoadingView from '../components/Loading'
import TrackCard from '../components/TrackCard'

export default function Tracks() {
  const [summaries, setSummaries] = useState<Leaderboard[]>([])
  const [loading, setLoading] = useState(true)
  const { socket } = useConnection()

  useEffect(() => {
    socket.emit(
      WS_GET_LEADERBOARD_SUMMARIES,
      undefined,
      (d: GetLeaderboardsResponse | ErrorResponse) => {
        if (!d.success) {
          console.error(d.message)
          return window.alert(d.message)
        }

        setSummaries(d.leaderboards)
        setLoading(false)
      }
    )
  }, [socket])

  if (loading) return <LoadingView />

  return (
    <div className='p-safe-or-4 flex-1'>
      <div className='grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-4'>
        {summaries.map(t => (
          <TrackCard key={t.track.id} leaderboard={t} />
        ))}
      </div>
    </div>
  )
}
