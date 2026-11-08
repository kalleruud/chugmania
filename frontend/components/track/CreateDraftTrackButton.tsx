import { useConnection } from '@/contexts/ConnectionContext'
import type { ResultDraftRequest } from '@common/models/resultDraft'
import type { Track } from '@common/models/track'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../ui/button'

export default function CreateDraftTrackButton({
  request,
  onCreated,
  disabled,
}: Readonly<{
  request: ResultDraftRequest
  onCreated: (track: Track) => void
  disabled?: boolean
}>) {
  const { socket } = useConnection()
  const [pending, setPending] = useState(false)

  async function createTrack() {
    setPending(true)
    try {
      const response = await socket.emitWithAck('create_draft_track', request)
      if (!response.success) throw new Error(response.message)
      onCreated(response.track)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Kunne ikke opprette bane'
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      type='button'
      variant='outline'
      disabled={disabled || pending}
      onClick={createTrack}>
      Opprett bane fra webhook
    </Button>
  )
}
