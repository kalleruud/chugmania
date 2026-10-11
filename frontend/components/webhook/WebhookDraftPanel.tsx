import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import WebhookDraftCard from './WebhookDraftCard'
import WebhookDraftRow from './WebhookDraftRow'

export default function WebhookDraftPanel({
  session,
}: Readonly<{ session: string }>) {
  const { isLoggedIn } = useAuth()
  const { webhookDrafts, isLoadingData } = useData()
  if (!isLoggedIn || isLoadingData) return null
  const drafts = webhookDrafts.filter(draft => draft.session === session)
  const draft = drafts.at(-1)
  if (!draft) return null
  return (
    <section aria-label='Løpsutkast' className='flex flex-col gap-3'>
      <h2 className='text-xl font-semibold'>Løpsutkast</h2>
      <WebhookDraftCard key={draft.gameId} draft={draft} />
      {drafts.length > 1 && (
        <div className='flex flex-col gap-2'>
          <h3 className='text-sm text-muted-foreground'>Tidligere utkast</h3>
          {drafts
            .slice(0, -1)
            .reverse()
            .map(older => (
              <WebhookDraftRow key={older.gameId} draft={older} />
            ))}
        </div>
      )}
    </section>
  )
}
