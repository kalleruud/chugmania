import { describe, expect, test } from 'bun:test'
import assert from 'node:assert/strict'
import SessionManager from '../backend/src/managers/session.manager'
import { broadcast, type TypedSocket } from '../backend/src/server'
import { assertResponse, createUser, login } from './utils'

const CREATED_DESCRIPTION = [
  '# Kveldens plan',
  '',
  '**Oppmøte** kl. 18',
  'Ta med *kontroller*',
  '',
  '- [ ] Pizza',
  '- [x] Øl',
  '',
  '| Runde | Bane |',
  '| --- | --- |',
  '| 1 | `001` |',
  '',
  '[Påmelding](https://example.test/rsvp) <b>raw</b>',
].join('\n')

const EDITED_DESCRIPTION = '> Flyttet\n\n~~kl. 18~~ kl. 19\n'

describe('Session markdown descriptions', () => {
  const sessionId = Bun.randomUUIDv7()
  let socket: TypedSocket

  async function fetchDescription() {
    const session = await SessionManager.getSession(sessionId)
    assert(session, 'Could not fetch session')
    return session.description
  }

  function expectBroadcastDescription(description: string) {
    expect(broadcast).toHaveBeenCalledWith(
      'all_sessions',
      expect.arrayContaining([
        expect.objectContaining({ id: sessionId, description }),
      ])
    )
  }

  test.serial('stores markdown exactly as written on create', async () => {
    socket = await login(createUser('markdown-admin', 'admin'))

    await SessionManager.onCreateSession(socket, {
      type: 'CreateSessionRequest',
      id: sessionId,
      name: 'Markdown Cup',
      description: CREATED_DESCRIPTION,
      date: new Date(0),
    }).then(assertResponse)

    expect(await fetchDescription()).toBe(CREATED_DESCRIPTION)
    expectBroadcastDescription(CREATED_DESCRIPTION)
  })

  test.serial('stores markdown exactly as written on edit', async () => {
    await SessionManager.onEditSession(socket, {
      type: 'EditSessionRequest',
      id: sessionId,
      description: EDITED_DESCRIPTION,
    }).then(assertResponse)

    expect(await fetchDescription()).toBe(EDITED_DESCRIPTION)
    expectBroadcastDescription(EDITED_DESCRIPTION)
  })
})
