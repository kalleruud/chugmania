import { expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import WebhookManager from '../backend/src/managers/webhook.manager'
import type { Event, Source } from '../backend/src/models/webhook.generated'
import type { ResultDraftRequest } from '../common/models/resultDraft'
import {
  assertResponse,
  createSession,
  createTracks,
  createUser,
  login,
} from './utils'

test('corrected lap drafts expose only result fields and publish idempotently', async () => {
  const user = createUser('draft-participant', 'admin')
  const socket = await login(user)
  const session = await createSession(socket, [])
  const [track] = createTracks()
  const game = { gameId: randomUUID(), totalPlayers: 1 }
  const now = new Date(0)
  const source: Source = {
    pluginName: 'TM Webhooks',
    pluginVersion: '1.0.0',
    game: 'turbo',
  }
  const base = {
    schemaVersion: '1.0.0',
    occurredAt: now.toISOString(),
    game,
    source,
  }
  const events: Event[] = [
    {
      ...base,
      eventId: randomUUID(),
      type: 'start',
      sequence: 0,
      durationMs: 0,
      players: [{ playerIndex: 0, name: 'Private player' }],
      map: null,
      mode: null,
    },
    {
      ...base,
      eventId: randomUUID(),
      type: 'end',
      sequence: 1,
      durationMs: 12000,
      endReason: 'completed',
    },
  ]
  for (const event of events)
    WebhookManager.receive(event, JSON.stringify(event), now)
  const draft = WebhookManager.getAllDrafts(session.id).timeEntries[0]
  expect(draft).toBeDefined()
  expect(draft).not.toHaveProperty('webhookCapture')
  const request: ResultDraftRequest = { kind: 'lap', id: draft.id }
  assertResponse(
    await WebhookManager.onClaim(socket, { ...request, playerIndex: 0 })
  )
  assertResponse(
    await WebhookManager.onSelectTrack(socket, { ...request, track: track.id })
  )
  assertResponse(
    await WebhookManager.onEditTimes(socket, {
      ...request,
      playerIndex: 0,
      finishDurationMs: 12000,
      chugDurationMs: 2000,
    })
  )
  expect(WebhookManager.getAllDrafts(session.id).timeEntries[0]).toMatchObject({
    user: user.id,
    track: track.id,
    duration: 12000,
    chugDurationMs: 2000,
  })
  assertResponse(await WebhookManager.onPublish(socket, request))
  expect(WebhookManager.getAllDrafts(session.id).timeEntries).toEqual([])
  assertResponse(await WebhookManager.onPublish(socket, request))
})
