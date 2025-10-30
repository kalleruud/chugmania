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
import { useTranslation } from '../../locales/useTranslation'
import LoadingView from '../components/LoadingView'
import PlayerRow from '../components/PlayerRow'

export default function Players() {
  const { t } = useTranslation()
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
          globalThis.alert(response.message)
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
        <p className='text-sm'>{t('pages.players.noPlayersYet')}</p>
      </div>
    )

  return (
    <div className='p-safe-or-4 flex justify-center'>
      <div className='flex w-full max-w-4xl flex-col gap-6'>
        <header className='space-y-2'>
          <p className='text-label-muted text-xs uppercase tracking-[0.35em]'>
            {t('pages.players.subtitle')}
          </p>
          <h1 className='font-f1-black text-4xl uppercase text-white sm:text-5xl'>
            {t('pages.players.heading')}
          </h1>
          <p className='text-label-secondary text-sm'>
            {t('pages.players.description')}
          </p>
        </header>

        <section className='font-f1 rounded-lg border border-white/10 bg-black/40 p-2 sm:p-3'>
          <div className='text-label-muted flex items-center gap-4 px-3 py-2 text-xs uppercase tracking-[0.35em] sm:px-4'>
            <span className='w-12'>{t('pages.players.columnRank')}</span>
            <span className='flex-1'>{t('pages.players.columnPlayer')}</span>
            <span className='w-16 text-right'>
              {t('pages.players.columnAvgPosition')}
            </span>
          </div>
          <div className='divide-y divide-white/10'>
            {players.map((summary, index) => (
              <PlayerRow
                key={summary.user.id}
                summary={summary}
                rank={index + 1}
                isSelf={summary.user.id === user?.id}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
