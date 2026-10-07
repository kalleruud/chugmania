import Combobox from '@/components/combobox'
import ConfirmationButton from '@/components/ConfirmationButton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import { trackToLookupItem, userToLookupItem } from '@/lib/lookup-utils'
import type { ErrorResponse, SuccessResponse } from '@common/models/socket.io'
import type { WebhookDraft } from '@common/models/webhook'
import { formatTrackLabel } from '@common/utils/track'
import { useState } from 'react'
import { toast } from 'sonner'
import WebhookAuditButton from './WebhookAuditButton'

function duration(ms: number | null): string {
  return ms === null ? '—' : `${(ms / 1000).toFixed(3)} s`
}

const blockerLabels: Record<string, string> = {
  'Waiting for end event': 'Venter på at løpet avsluttes',
  'Missing webhook events': 'Venter på manglende løpsdata',
  'Select a track': 'Velg en bane',
  'Assign every player': 'Tildel alle spillere',
  'Players must be different users': 'Spillerne må være forskjellige brukere',
  'No valid finish result': 'Mangler en gyldig sluttid',
  'Finish times are tied': 'Spillerne har lik sluttid',
  'Session was deleted': 'Session er slettet',
  'Session is cancelled': 'Session er avlyst',
}

export default function WebhookDraftCard({
  draft,
}: Readonly<{ draft: WebhookDraft }>) {
  const { socket, isConnected } = useConnection()
  const { isLoggedIn, loggedInUser } = useAuth()
  const { tracks, users, isLoadingData } = useData()
  const [busy, setBusy] = useState(false)
  if (!isLoggedIn || isLoadingData) return null
  const moderator = loggedInUser.role !== 'user'
  const participant = draft.players.some(p => p.user === loggedInUser.id)
  const disabled = busy || !isConnected
  const trackItems = tracks.filter(t => !t.deletedAt).map(trackToLookupItem)
  const userItems = users.filter(u => !u.deletedAt).map(userToLookupItem)
  const track = tracks.find(t => t.id === draft.track)
  const run = async (operation: Promise<SuccessResponse | ErrorResponse>) => {
    setBusy(true)
    try {
      const response = await operation
      if (!response.success) throw new Error(response.message)
      toast.success('Utkast oppdatert')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Kunne ikke oppdatere utkast'
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <article className='flex flex-col gap-3 rounded-sm border border-amber-500/40 bg-amber-500/5 p-4'>
      <div className='flex flex-wrap items-center gap-2'>
        <Badge variant='outline'>
          Utkast · {draft.kind === 'lap' ? 'Rundetid' : 'Match'}
        </Badge>
        <h3 className='font-semibold'>
          {track ? formatTrackLabel(track) : (draft.map?.name ?? 'Ukjent bane')}
        </h3>
        {draft.map && (
          <span className='text-sm text-muted-foreground'>
            {draft.map.environment} · {draft.map.author}
          </span>
        )}
        {draft.endReason && <Badge variant='outline'>{draft.endReason}</Badge>}
      </div>
      {draft.players.map(player => {
        const assigned = userItems.find(user => user.id === player.user)
        const own = player.user === loggedInUser.id
        return (
          <div
            key={player.playerIndex}
            className='flex flex-wrap items-center gap-3'>
            <span>{player.name}</span>
            <span className='text-sm tabular-nums'>
              Tid:{' '}
              {player.finishDurationMs === null && draft.endReason
                ? 'DNF'
                : duration(player.finishDurationMs)}{' '}
              · Chug: {duration(player.chugDurationMs)}
            </span>
            {moderator ? (
              <Combobox
                aria-label={`Spiller ${player.playerIndex + 1}`}
                className='min-w-48'
                placeholder='Tildel spiller'
                items={userItems}
                selected={assigned}
                disabled={disabled}
                setSelected={user =>
                  void run(
                    socket.emitWithAck('assign_webhook_player', {
                      gameId: draft.gameId,
                      playerIndex: player.playerIndex,
                      user: user?.id ?? null,
                    })
                  )
                }
              />
            ) : (
              <>
                <span className='text-sm text-muted-foreground'>
                  {assigned?.label ?? 'Ikke tildelt'}
                </span>
                {(own || (!player.user && !participant)) && (
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={disabled}
                    onClick={() =>
                      void run(
                        socket.emitWithAck('claim_webhook_player', {
                          gameId: draft.gameId,
                          playerIndex: player.playerIndex,
                          release: own,
                        })
                      )
                    }>
                    {own ? 'Frigi plassen' : 'Dette er meg'}
                  </Button>
                )}
              </>
            )}
          </div>
        )
      })}
      {moderator && (
        <div className='flex flex-wrap items-center gap-2'>
          <Combobox
            aria-label='Bane for utkast'
            className='min-w-64'
            placeholder='Velg bane'
            items={trackItems}
            selected={trackItems.find(t => t.id === draft.track)}
            disabled={disabled}
            setSelected={selected => {
              if (selected)
                void run(
                  socket.emitWithAck('select_webhook_track', {
                    gameId: draft.gameId,
                    track: selected.id,
                  })
                )
            }}
          />
          {draft.map && (
            <Button
              variant='outline'
              disabled={disabled}
              onClick={() =>
                void run(
                  socket.emitWithAck('create_webhook_track', {
                    gameId: draft.gameId,
                  })
                )
              }>
              Opprett bane fra opptak
            </Button>
          )}
        </div>
      )}
      {draft.blockers.length > 0 && (
        <ul className='list-inside list-disc text-sm text-muted-foreground'>
          {draft.blockers.map(blocker => (
            <li key={blocker}>{blockerLabels[blocker] ?? blocker}</li>
          ))}
        </ul>
      )}
      <div className='flex gap-2'>
        <WebhookAuditButton
          gameId={draft.gameId}
          participants={draft.players.map(player => player.user)}
        />
        {(moderator || participant) && (
          <Button
            disabled={disabled || draft.blockers.length > 0}
            onClick={() =>
              void run(
                socket.emitWithAck('publish_webhook_draft', {
                  gameId: draft.gameId,
                })
              )
            }>
            Publiser
          </Button>
        )}
        {moderator && (
          <ConfirmationButton
            variant='destructive'
            disabled={disabled}
            onClick={() =>
              void run(
                socket.emitWithAck('discard_webhook_draft', {
                  gameId: draft.gameId,
                })
              )
            }>
            Forkast
          </ConfirmationButton>
        )}
      </div>
    </article>
  )
}
