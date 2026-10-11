import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from '@/components/ui/card'
import { useData } from '@/contexts/DataContext'
import type { WebhookDraft } from '@common/models/webhook'
import { formatTime } from '@common/utils/time'
import { formatTrackLabel } from '@common/utils/track'
import { blockerLabels } from './blocker-labels'
import WebhookAuditButton from './WebhookAuditButton'
import WebhookDraftEditButton from './WebhookDraftEditButton'

export default function WebhookDraftCard({
  draft,
}: Readonly<{ draft: WebhookDraft }>) {
  const { tracks, users } = useData()
  const track = tracks?.find(item => item.id === draft.track)
  const name = track
    ? formatTrackLabel(track)
    : (draft.map?.name ?? 'Ukjent bane')
  return (
    <Card
      role='article'
      aria-label={`Siste løpsutkast: ${name}`}
      className='gap-4 rounded-md'>
      <CardHeader>
        <div className='flex flex-wrap items-center gap-2'>
          <Badge variant='outline'>
            Siste utkast · {draft.kind === 'lap' ? 'Rundetid' : 'Match'}
          </Badge>
          <Badge variant='outline'>{draft.endReason ?? 'Pågår'}</Badge>
        </div>
        <h3 className='text-2xl wrap-anywhere'>{name}</h3>
        {draft.map && (
          <CardDescription>
            {draft.map.environment} · {draft.map.author}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className='flex flex-col gap-4'>
        {draft.players.map(player => {
          const assigned = users?.find(user => user.id === player.user)
          return (
            <div
              key={player.playerIndex}
              className='flex flex-col gap-2 rounded-sm border bg-muted/20 p-3'>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <span className='font-semibold'>{player.name}</span>
                <span className='text-sm text-muted-foreground'>
                  {assigned?.firstName ?? 'Ikke tildelt'}
                </span>
              </div>
              <dl className='grid grid-cols-2 gap-3'>
                <div>
                  <dt className='text-sm text-muted-foreground'>
                    Foreløpig rundetid
                  </dt>
                  <dd className='font-f1-italic text-xl tabular-nums'>
                    {formatTime(player.latestDurationMs)}
                  </dd>
                </div>
                <div>
                  <dt className='text-sm text-muted-foreground'>Chugtid</dt>
                  <dd className='font-f1-italic text-xl tabular-nums'>
                    {player.chugDurationMs === null
                      ? '—'
                      : formatTime(player.chugDurationMs)}
                  </dd>
                </div>
              </dl>
              {player.finishDurationMs === null && draft.endReason && (
                <span className='text-sm text-muted-foreground'>DNF</span>
              )}
              {player.finishDurationMs !== null &&
                player.finishDurationMs !== player.latestDurationMs && (
                  <span className='text-sm text-muted-foreground'>
                    Beste sluttid: {formatTime(player.finishDurationMs)}
                  </span>
                )}
            </div>
          )
        })}
        {draft.blockers.length > 0 ? (
          <ul className='list-inside list-disc text-sm text-muted-foreground'>
            {draft.blockers.map(blocker => (
              <li key={blocker}>{blockerLabels[blocker] ?? blocker}</li>
            ))}
          </ul>
        ) : (
          <p className='text-sm text-primary'>Klar for publisering</p>
        )}
      </CardContent>
      <CardFooter className='flex-wrap gap-2'>
        <WebhookDraftEditButton draft={draft} />
        <WebhookAuditButton
          gameId={draft.gameId}
          participants={draft.players.map(player => player.user)}
        />
      </CardFooter>
    </Card>
  )
}
