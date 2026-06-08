import type {
  CaptureAssignment,
  UnconfirmedRound,
} from '@common/models/capture'
import { formatTime } from '@common/utils/time'
import { useState } from 'react'
import { toast } from 'sonner'
import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import loc from '@/lib/locales'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { NativeSelect } from '@/components/ui/native-select'
import { Button } from '@/components/ui/button'

type Props = {
  round: UnconfirmedRound | null
  onClose: () => void
}

export function ConfirmRoundDialog({ round, onClose }: Props) {
  const { socket } = useConnection()
  const { users, tracks } = useData()
  const [picks, setPicks] = useState<Record<number, string>>({})

  if (!round) return null

  const track = tracks.find(t => t.id === round.track)
  const sortedLaps = [...round.laps].sort((a, b) => a.slot - b.slot)

  function setPick(slot: number, user: string) {
    setPicks(prev => ({ ...prev, [slot]: user }))
  }

  function swap() {
    if (sortedLaps.length !== 2) return
    const [s1, s2] = sortedLaps
    setPicks(prev => ({
      ...prev,
      [s1.slot]: prev[s2.slot] ?? '',
      [s2.slot]: prev[s1.slot] ?? '',
    }))
  }

  function confirm() {
    const assignments: CaptureAssignment[] = sortedLaps.map(l => ({
      slot: l.slot,
      user: picks[l.slot],
    }))
    toast.promise(
      socket
        .emitWithAck('confirm_capture', {
          type: 'ConfirmCaptureRequest',
          heatId: round.heatId,
          assignments,
        })
        .then(r => {
          if (!r.success) throw new Error(r.message)
        }),
      loc.no.capture.confirmRequest,
    )
    onClose()
  }

  function discard() {
    toast.promise(
      socket
        .emitWithAck('discard_capture', {
          type: 'DiscardCaptureRequest',
          heatId: round.heatId,
        })
        .then(r => {
          if (!r.success) throw new Error(r.message)
        }),
      loc.no.capture.discardRequest,
    )
    onClose()
  }

  return (
    <Dialog open={!!round} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{loc.no.capture.assignTitle}</DialogTitle>
        </DialogHeader>
        <p className='text-muted-foreground text-sm'>
          {track?.name ?? track?.mapUid}
        </p>
        <div className='flex flex-col gap-3'>
          {sortedLaps.map(lap => (
            <div
              key={lap.slot}
              className='flex items-center justify-between gap-3'
            >
              <span className='font-mono tabular-nums'>
                {formatTime(lap.duration)}
              </span>
              <NativeSelect
                value={picks[lap.slot] ?? ''}
                onChange={e => setPick(lap.slot, e.target.value)}
              >
                <option value='' disabled>
                  {loc.no.capture.selectPlayer}
                </option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName ?? ''}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ))}
        </div>
        <DialogFooter className='flex-row justify-between'>
          <Button variant='ghost' onClick={discard}>
            {loc.no.capture.discard}
          </Button>
          <div className='flex gap-2'>
            {sortedLaps.length === 2 && (
              <Button variant='outline' onClick={swap}>
                {loc.no.capture.swap}
              </Button>
            )}
            <Button onClick={confirm}>{loc.no.capture.confirm}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
