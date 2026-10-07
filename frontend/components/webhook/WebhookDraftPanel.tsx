import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import type { WebhookDraft, WebhookDrafts } from '@common/models/webhook'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import WebhookDraftCard from './WebhookDraftCard'

export default function WebhookDraftPanel({
  session,
}: Readonly<{ session: string }>) {
  const { socket, isConnected } = useConnection()
  const { isLoggedIn } = useAuth()
  const [drafts, setDrafts] = useState<WebhookDraft[]>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!isConnected || !isLoggedIn) return
    let active = true
    let version = 0
    let previous: string | undefined
    const load = async (notify = false) => {
      const current = ++version
      try {
        const response = await socket.emitWithAck('get_webhook_drafts', {
          session,
        })
        if (!active || current !== version) return
        if (!response.success) throw new Error(response.message)
        const serialized = JSON.stringify(response.drafts)
        if (notify && previous !== undefined && previous !== serialized)
          toast.info('Løpsutkastene er oppdatert')
        previous = serialized
        setDrafts(response.drafts)
        setError(null)
      } catch (reason) {
        if (active && current === version)
          setError(
            reason instanceof Error ? reason.message : 'Kunne ikke hente utkast'
          )
      }
    }
    const onChange = (data: WebhookDrafts, actor?: string | null) => {
      if (data.session === session) void load(actor !== socket.id)
    }
    const onDependenciesChange = () => void load(true)
    socket.on('webhook_drafts_changed', onChange)
    socket.on('all_sessions', onDependenciesChange)
    socket.on('all_users', onDependenciesChange)
    socket.on('all_tracks', onDependenciesChange)
    void load()
    return () => {
      active = false
      socket.off('webhook_drafts_changed', onChange)
      socket.off('all_sessions', onDependenciesChange)
      socket.off('all_users', onDependenciesChange)
      socket.off('all_tracks', onDependenciesChange)
    }
  }, [socket, session, isConnected, isLoggedIn])
  if (!isLoggedIn) return null
  return (
    <section aria-label='Løpsutkast' className='flex flex-col gap-3'>
      {error && (
        <p role='alert' className='text-destructive'>
          {error}
        </p>
      )}
      {drafts.length > 0 && (
        <h2 className='text-xl font-semibold'>Løpsutkast</h2>
      )}
      {drafts.map(draft => (
        <WebhookDraftCard key={draft.gameId} draft={draft} />
      ))}
    </section>
  )
}
