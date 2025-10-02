import { TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { PlayerSummary } from '../../../common/models/playerSummary'
import {
  type ErrorResponse,
  type GetPlayerSummariesResponse,
} from '../../../common/models/responses'
import { WS_GET_PLAYER_SUMMARIES } from '../../../common/utils/constants'
import { useAuth } from '../../contexts/AuthContext'
import { useConnection } from '../../contexts/ConnectionContext'
import LoadingView from '../components/Loading'
import PlayerCard from '../components/PlayerCard'

export default function Players() {
  const { socket } = useConnection()
  const { user } = useAuth()
  const [players, setPlayers] = useState<PlayerSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    socket.emit(
      WS_GET_PLAYER_SUMMARIES,
      undefined,
      (response: GetPlayerSummariesResponse | ErrorResponse) => {
        if (!response.success) {
          console.error(response.message)
          window.alert(response.message)
          setLoading(false)
          return
        }

        setPlayers(response.players)
        setLoading(false)
      }
    )
  }, [socket])

  if (loading) return <LoadingView />

  if (!players.length)
    return (
      <div className='font-f1 text-label-muted flex h-screen flex-col items-center justify-center gap-2'>
        <TriangleAlert className='text-warning size-16' />
        <p className='text-sm'>No players registered yet.</p>
      </div>
    )

  return (
    <div className='p-safe-or-4 flex-1 space-y-8'>
      <div className='grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4'>
        {players.map(summary => (
          <PlayerCard
            key={summary.user.id}
            summary={summary}
            isSelf={summary.user.id === user?.id}
          />
        ))}
      </div>
    </div>
  )
}
