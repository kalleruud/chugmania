import type { LeaderboardEntry } from '@chugmania/common/models/timeEntry.js'
import {
  type ErrorResponse,
  type GetLeaderboardsResponse,
} from '@chugmania/common/models/responses.js'
import { WS_GET_LEADERBOARD } from '@chugmania/common/utils/constants.js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useConnection } from '../../contexts/ConnectionContext'
import SearchBar from '../components/SearchBar'
import Spinner from '../components/Spinner'
import Tag from '../components/Tag'
import TimeEntryRow from '../components/TimeEntryRow'
import LapTimeInput from '../components/LapTimeInput'

export default function Track() {
  const { id } = useParams()
  const { socket } = useConnection()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [gapType, setGapType] = useState<'leader' | 'gap'>('leader')
  const [search, setSearch] = useState('')
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const load = useCallback(
    (o: number) => {
      if (!id) return
      setLoading(true)
      socket.emit(
        WS_GET_LEADERBOARD,
        { trackId: id, offset: o },
        (r: GetLeaderboardsResponse | ErrorResponse) => {
          if (!r.success) {
            console.error(r.message)
            window.alert(r.message)
            setLoading(false)
            return
          }
          const lb = r.leaderboards[0]
          setEntries(prev => [...prev, ...lb.entries])
          setTotal(lb.totalEntries)
          setLoading(false)
        }
      )
    },
    [id, socket]
  )

  useEffect(() => {
    if (!id) return
    setEntries([])
    setOffset(0)
    load(0)
  }, [id, load])

  useEffect(() => {
    if (offset === 0) return
    load(offset)
  }, [offset, load])

  useEffect(() => {
    if (!loadMoreRef.current) return
    const observer = new IntersectionObserver(obs => {
      const first = obs[0]
      if (first?.isIntersecting && !loading && entries.length < total) {
        setOffset(prev => prev + 100)
      }
    })
    observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [entries.length, loading, total])

  const term = search.toLowerCase()

  function scrollToFirstMatch() {
    const match = entries.find(e =>
      e.user.name.toLowerCase().includes(term)
    )
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
          <Tag onClick={() => setGapType('leader')} selected={gapType === 'leader'}>
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
          <div ref={loadMoreRef} />
        </div>
      </div>
    </div>
  )
}

