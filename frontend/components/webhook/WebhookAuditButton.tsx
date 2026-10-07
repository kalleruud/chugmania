import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import { useState } from 'react'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog'

export default function WebhookAuditButton({
  gameId,
  participants,
}: Readonly<{ gameId: string | null; participants: (string | null)[] }>) {
  const { socket, isConnected } = useConnection()
  const { isLoggedIn, loggedInUser } = useAuth()
  const [payloads, setPayloads] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (
    !gameId ||
    !isLoggedIn ||
    (loggedInUser.role === 'user' && !participants.includes(loggedInUser.id))
  )
    return null
  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await socket.emitWithAck('get_webhook_events', {
        gameId,
      })
      if (!response.success) throw new Error(response.message)
      setPayloads(response.events.map(event => event.rawPayload))
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Kunne ikke hente løpsdata'
      )
    } finally {
      setLoading(false)
    }
  }
  return (
    <div
      onClick={event => event.stopPropagation()}
      onKeyDown={event => event.stopPropagation()}>
      <Dialog
        onOpenChange={open => {
          if (open) void load()
        }}>
        <DialogTrigger asChild>
          <Button size='sm' variant='outline' disabled={!isConnected}>
            Løpsdata
          </Button>
        </DialogTrigger>
        <DialogContent className='sm:max-w-3xl'>
          <DialogHeader>
            <DialogTitle>Originale løpsdata</DialogTitle>
            <DialogDescription>{gameId}</DialogDescription>
          </DialogHeader>
          {loading && <p>Henter løpsdata...</p>}
          {error && (
            <p role='alert' className='text-destructive'>
              {error}
            </p>
          )}
          {!loading && !error && (
            <div className='max-h-[65dvh] overflow-auto'>
              <pre className='text-xs wrap-break-word whitespace-pre-wrap'>
                {payloads.join('\n\n')}
              </pre>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
