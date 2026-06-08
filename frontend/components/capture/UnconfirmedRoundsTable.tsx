import type { UnconfirmedRound } from '@common/models/capture'
import { formatTime } from '@common/utils/time'
import { useState } from 'react'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import { ConfirmRoundDialog } from './ConfirmRoundDialog'

export function UnconfirmedRoundsTable({ sessionId }: { sessionId: string }) {
  const { unconfirmedRounds, tracks } = useData()
  const [selected, setSelected] = useState<UnconfirmedRound | null>(null)

  const rounds = unconfirmedRounds.filter(r => r.session === sessionId)
  if (rounds.length === 0) return null

  return (
    <div className='flex flex-col gap-2'>
      <h3 className='text-muted-foreground text-sm font-semibold uppercase'>
        {loc.no.capture.unconfirmedTitle}
      </h3>
      <div className='bg-background-secondary flex flex-col rounded-sm opacity-60'>
        {rounds.flatMap(round =>
          [...round.laps]
            .sort((a, b) => a.slot - b.slot)
            .map(lap => {
              const track = tracks.find(t => t.id === round.track)
              return (
                <button
                  key={`${round.heatId}-${lap.slot}`}
                  onClick={() => setSelected(round)}
                  className='flex items-center justify-between px-4 py-3 text-left hover:opacity-100'
                >
                  <span className='text-muted-foreground'>
                    {track?.name ?? track?.mapUid}
                  </span>
                  <span className='font-mono tabular-nums'>
                    {formatTime(lap.duration)}
                  </span>
                </button>
              )
            }),
        )}
      </div>
      <ConfirmRoundDialog
        key={selected?.heatId ?? 'none'}
        round={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}
