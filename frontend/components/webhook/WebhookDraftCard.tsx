import Combobox from '@/components/combobox'
import ConfirmationButton from '@/components/ConfirmationButton'
import { SessionRow } from '@/components/session/SessionRow'
import DurationInput from '@/components/timeentries/DurationInput'
import { TrackRow } from '@/components/track/TrackRow'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import UserRow from '@/components/user/UserRow'
import { useAuth } from '@/contexts/AuthContext'
import { useConnection } from '@/contexts/ConnectionContext'
import { useData } from '@/contexts/DataContext'
import {
  sessionToLookupItem,
  trackToLookupItem,
  userToLookupItem,
} from '@/lib/lookup-utils'
import type { ErrorResponse, SuccessResponse } from '@common/models/socket.io'
import type { WebhookDraft } from '@common/models/webhook'
import {
  durationToInputList,
  formatTime,
  inputListToMs,
} from '@common/utils/time'
import { useState } from 'react'
import { toast } from 'sonner'
import WebhookAuditButton from './WebhookAuditButton'

type TimeEdits = { finish?: string[]; chug?: string[] }

function chugDigits(ms: number | null): string[] {
  return ms === 0 ? new Array<string>(7).fill('0') : durationToInputList(ms)
}

function editedDuration(digits: string[]): number | null {
  return digits.every(digit => digit === '') ? null : inputListToMs(digits)
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
  const { tracks, users, sessions, isLoadingData } = useData()
  const [busy, setBusy] = useState(false)
  const [edits, setEdits] = useState<Record<number, TimeEdits | undefined>>({})
  if (!isLoggedIn || isLoadingData) return null
  const moderator = loggedInUser.role !== 'user'
  const participant = draft.players.some(p => p.user === loggedInUser.id)
  const disabled = busy || !isConnected
  const trackItems = tracks.filter(t => !t.deletedAt).map(trackToLookupItem)
  const userItems = users.filter(u => !u.deletedAt).map(userToLookupItem)
  const session = sessions.find(s => s.id === draft.session)
  const hasEdits = Object.values(edits).some(edit => edit !== undefined)
  const run = async (operation: Promise<SuccessResponse | ErrorResponse>) => {
    setBusy(true)
    try {
      const response = await operation
      if (!response.success) throw new Error(response.message)
      toast.success('Utkast oppdatert')
      return true
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Kunne ikke oppdatere utkast'
      )
      return false
    } finally {
      setBusy(false)
    }
  }
  const saveTimes = async () => {
    for (const player of draft.players) {
      const edit = edits[player.playerIndex]
      if (!edit) continue
      const saved = await run(
        socket.emitWithAck('edit_webhook_times', {
          gameId: draft.gameId,
          playerIndex: player.playerIndex,
          ...(edit.finish
            ? { finishDurationMs: editedDuration(edit.finish) }
            : {}),
          ...(edit.chug ? { chugDurationMs: editedDuration(edit.chug) } : {}),
        })
      )
      if (!saved) return
      setEdits(previous => ({ ...previous, [player.playerIndex]: undefined }))
    }
  }
  return (
    <article className='mx-auto flex w-full max-w-md flex-col gap-6'>
      <div className='flex flex-wrap items-center gap-2'>
        <Badge variant='outline'>
          Utkast · {draft.kind === 'lap' ? 'Rundetid' : 'Match'}
        </Badge>
        {draft.endReason && <Badge variant='outline'>{draft.endReason}</Badge>}
      </div>
      {draft.players.map(player => {
        const assigned = userItems.find(user => user.id === player.user)
        const own = player.user === loggedInUser.id
        return (
          <div key={player.playerIndex} className='flex flex-col gap-6'>
            <div className='flex flex-col gap-2'>
              <span className='text-sm text-muted-foreground'>
                {player.name} · Foreløpig rundetid
                {player.finishDurationMs === null &&
                  draft.endReason &&
                  ' · DNF'}
              </span>
              <DurationInput
                label={`Rundetid spiller ${player.playerIndex + 1}`}
                digits={
                  edits[player.playerIndex]?.finish ??
                  durationToInputList(player.latestDurationMs)
                }
                disabled={disabled || (!moderator && !own)}
                onChange={finish =>
                  setEdits(previous => ({
                    ...previous,
                    [player.playerIndex]: {
                      ...previous[player.playerIndex],
                      finish,
                    },
                  }))
                }
              />
              {player.finishDurationMs !== null &&
                player.finishDurationMs !== player.latestDurationMs && (
                  <span className='text-sm text-muted-foreground'>
                    Beste sluttid: {formatTime(player.finishDurationMs)}
                  </span>
                )}
            </div>
            <div className='flex flex-col gap-2'>
              <span className='text-sm text-muted-foreground'>
                Chugtid{player.chugDurationMs === null && ' · Ikke registrert'}
              </span>
              <DurationInput
                label={`Chugtid spiller ${player.playerIndex + 1}`}
                digits={
                  edits[player.playerIndex]?.chug ??
                  chugDigits(player.chugDurationMs)
                }
                disabled={disabled || (!moderator && !own)}
                onChange={chug =>
                  setEdits(previous => ({
                    ...previous,
                    [player.playerIndex]: {
                      ...previous[player.playerIndex],
                      chug,
                    },
                  }))
                }
              />
            </div>
            {moderator ? (
              <Combobox
                aria-label={`Spiller ${player.playerIndex + 1}`}
                className='w-full'
                required
                limit={4}
                align='start'
                CustomRow={props => <UserRow {...props} hideRanking />}
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
                <Combobox
                  aria-label={`Spiller ${player.playerIndex + 1}`}
                  className='w-full'
                  placeholder='Tildel spiller'
                  items={userItems}
                  selected={assigned}
                  disabled
                  setSelected={() => {}}
                  CustomRow={props => <UserRow {...props} hideRanking />}
                />
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
      <div className='flex flex-col gap-2'>
        <Combobox
          aria-label='Bane for utkast'
          className='w-full'
          required
          limit={4}
          align='start'
          CustomRow={TrackRow}
          placeholder={draft.map?.name ?? 'Velg bane'}
          items={trackItems}
          selected={trackItems.find(t => t.id === draft.track)}
          disabled={disabled || !moderator}
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
        <Combobox
          aria-label='Session for utkast'
          className='w-full'
          placeholder='Velg session'
          items={sessions.map(sessionToLookupItem)}
          selected={session}
          disabled
          setSelected={() => {}}
          CustomRow={SessionRow}
        />
        {moderator && draft.map && (
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
      {hasEdits && (
        <Button
          variant='outline'
          disabled={disabled}
          onClick={() => void saveTimes()}>
          Lagre tidsendringer
        </Button>
      )}
      {draft.blockers.length > 0 && (
        <ul className='list-inside list-disc text-sm text-muted-foreground'>
          {draft.blockers.map(blocker => (
            <li key={blocker}>{blockerLabels[blocker] ?? blocker}</li>
          ))}
        </ul>
      )}
      <div className='flex flex-wrap gap-2'>
        <WebhookAuditButton
          gameId={draft.gameId}
          participants={draft.players.map(player => player.user)}
        />
        {(moderator || participant) && (
          <Button
            disabled={disabled || hasEdits || draft.blockers.length > 0}
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
