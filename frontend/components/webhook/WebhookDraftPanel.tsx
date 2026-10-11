import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import WebhookDraftCard from './WebhookDraftCard'

export default function WebhookDraftPanel({
  session,
}: Readonly<{ session: string }>) {
  const { isLoggedIn } = useAuth()
  const { webhookDrafts, isLoadingData } = useData()
  if (!isLoggedIn || isLoadingData) return null
  const draft = webhookDrafts.filter(draft => draft.session === session).at(-1)
  if (!draft) return null
  return (
    <section aria-label='Løpsutkast' className='flex flex-col gap-3'>
      <h2 className='text-xl font-semibold'>Løpsutkast</h2>
      <WebhookDraftCard key={draft.gameId} draft={draft} />
    </section>
  )
}
