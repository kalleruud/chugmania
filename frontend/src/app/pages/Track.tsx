import type { GetLeaderboardRequest } from '@chugmania/common/models/requests.js'
import {
  type ErrorResponse,
  type GetLeaderboardsResponse,
} from '@chugmania/common/models/responses.js'
import type { LeaderboardEntry } from '@chugmania/common/models/timeEntry.js'
import { WS_GET_LEADERBOARD } from '@chugmania/common/utils/constants.js'
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useConnection } from '../../contexts/ConnectionContext'
import LapTimeInput from '../components/LapTimeInput'
import SearchBar from '../components/SearchBar'
import Spinner from '../components/Spinner'
import Tag from '../components/Tag'
import TimeEntryRow from '../components/TimeEntryRow'

export default function Track() {
  const { id } = useParams()
  const { socket } = useConnection()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [gapType, setGapType] = useState<'leader' | 'gap'>('leader')
  const [search, setSearch] = useState('')

  const load = useCallback(() => {
    if (!id) return
    setLoading(true)
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
        setLoading(false)
      }
    )
  }, [id, socket])

  useEffect(() => {
    if (!id) return
    setEntries([])
    load()
  }, [id, load])

  const term = search.toLowerCase()

  function scrollToFirstMatch() {
    const match = entries.find(e => e.user.name.toLowerCase().includes(term))
    if (match) {
      document
        .getElementById(`entry-${match.id}`)
        ?.scrollIntoView({ block: 'center' })
    }
  }

  return (
    <div className='flex flex-col gap-4'>
      <LapTimeInput trackId={id} />
      <div className='mx-auto w-full max-w-3xl space-y-4'>
        <form
          onSubmit={e => {
            e.preventDefault()
            scrollToFirstMatch()
          }}
        >
          <SearchBar value={search} onChange={setSearch} />
        </form>
        <div className='flex gap-2'>
          <Tag
            onClick={() => setGapType('leader')}
            selected={gapType === 'leader'}
          >
            Leader gap
          </Tag>
          <Tag onClick={() => setGapType('gap')} selected={gapType === 'gap'}>
            Previous gap
          </Tag>
        </div>
        <div className='border-b border-white/10' />
        <div className='relative'>
          <table className='w-full table-auto'>
            <tbody>
              {entries.map(e => {
                const match = e.user.name.toLowerCase().includes(term)
                return (
                  <TimeEntryRow
                    key={e.id}
                    id={`entry-${e.id}`}
                    lapTime={e}
                    gapType={gapType}
                    className={match ? undefined : 'opacity-30'}
                  />
                )
              })}
            </tbody>
          </table>
          {loading && (
            <div className='flex justify-center p-4'>
              <Spinner size={24} className='text-accent' />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
