import { Badge } from '@/components/ui/badge'
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item'
import { useData } from '@/contexts/DataContext'
import type { WebhookDraft } from '@common/models/webhook'
import { formatTime } from '@common/utils/time'
import { formatTrackLabel } from '@common/utils/track'
import WebhookAuditButton from './WebhookAuditButton'
import WebhookDraftEditButton from './WebhookDraftEditButton'

export default function WebhookDraftRow({
  draft,
}: Readonly<{ draft: WebhookDraft }>) {
  const { tracks, users } = useData()
  const track = tracks?.find(item => item.id === draft.track)
  const name = track
    ? formatTrackLabel(track)
    : (draft.map?.name ?? 'Ukjent bane')
  return (
    <Item
      role='article'
      aria-label={`Tidligere løpsutkast: ${name}`}
      variant='outline'
      size='sm'>
      <ItemContent className='min-w-0 gap-2'>
        <ItemTitle className='flex-wrap'>
          <span className='wrap-anywhere'>{name}</span>
          <Badge variant='outline'>
            {draft.kind === 'lap' ? 'Rundetid' : 'Match'}
          </Badge>
          <Badge variant='outline'>{draft.endReason ?? 'Pågår'}</Badge>
        </ItemTitle>
        {draft.players.map(player => {
          const assigned = users?.find(user => user.id === player.user)
          return (
            <div
              key={player.playerIndex}
              className='flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1'>
              <span className='text-muted-foreground'>
                {player.name} · {assigned?.firstName ?? 'Ikke tildelt'}
              </span>
              <span className='text-sm tabular-nums'>
                {formatTime(player.latestDurationMs)}
                {player.finishDurationMs === null &&
                  draft.endReason &&
                  ' · DNF'}
                <span className='text-muted-foreground'>
                  {' '}
                  · Chug:{' '}
                  {player.chugDurationMs === null
                    ? '—'
                    : formatTime(player.chugDurationMs)}
                </span>
              </span>
            </div>
          )
        })}
      </ItemContent>
      <ItemActions className='flex-wrap'>
        <WebhookDraftEditButton draft={draft} />
        <WebhookAuditButton
          gameId={draft.gameId}
          participants={draft.players.map(player => player.user)}
        />
      </ItemActions>
    </Item>
  )
}
