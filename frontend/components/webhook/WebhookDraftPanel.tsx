import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import WebhookDraftCard from './WebhookDraftCard'

export default function WebhookDraftPanel({
  session,
}: Readonly<{ session: string }>) {
  const { isLoggedIn } = useAuth()
  const { webhookDrafts, isLoadingData } = useData()
  if (!isLoggedIn || isLoadingData) return null
  const drafts = webhookDrafts.filter(draft => draft.session === session)
  return (
    <section aria-label='Løpsutkast' className='flex flex-col gap-3'>
      {drafts.length > 0 && (
        <h2 className='text-xl font-semibold'>Løpsutkast</h2>
      )}
      {drafts.map(draft => (
        <WebhookDraftCard key={draft.gameId} draft={draft} />
      ))}
    </section>
  )
}
