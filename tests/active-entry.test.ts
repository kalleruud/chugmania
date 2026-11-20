import type { EntryRef, QueuedEntry } from '@common/models/activeEntry'
import type { CreateMatch, Match } from '@common/models/match'
import type { TimeEntry } from '@common/models/timeEntry'
import type { TournamentConfig } from '@common/models/tournament'
import { getSessionQueue } from '@common/utils/activeEntry'
import { getTournamentStages } from '@common/utils/tournament'
import { describe, expect, test } from 'bun:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import WebhookSource from '../backend/database/sources/webhook.source'
import ActiveEntryManager from '../backend/src/managers/activeEntry.manager'
import MatchManager from '../backend/src/managers/match.manager'
import SessionManager from '../backend/src/managers/session.manager'
import TimeEntryManager from '../backend/src/managers/timeEntry.manager'
import TournamentManager from '../backend/src/managers/tournament/tournament.manager'
import { broadcast, type TypedSocket } from '../backend/src/server'
import {
  assertResponse,
  createRsvps,
  createSession,
  createTracks,
  createUser,
  login,
} from './utils'

async function createMatch(
  socket: TypedSocket,
  session: string,
  fields: Partial<CreateMatch> = {}
): Promise<Match> {
  const existing = new Set(MatchManager.getAllBySession(session).map(m => m.id))
  await Bun.sleep(2)
  assertResponse(
    await MatchManager.onCreateMatch(socket, {
      type: 'CreateMatchRequest',
      session,
      status: 'planned',
      ...fields,
    })
  )
  const match = MatchManager.getAllBySession(session).find(
    m => !existing.has(m.id)
  )
  assert(match)
  return match
}

async function createLap(
  socket: TypedSocket,
  session: string,
  user: string,
  status: TimeEntry['status'] = 'planned'
): Promise<TimeEntry> {
  const id = randomUUID()
  await Bun.sleep(2)
  assertResponse(
    await TimeEntryManager.onPostTimeEntry(socket, {
      type: 'CreateTimeEntryRequest',
      id,
      session,
      user,
      status,
    })
  )
  const entry = (await TimeEntryManager.getAllTimeEntries()).find(
    e => e.id === id
  )
  assert(entry)
  return entry
}

function createCapture(session: string, totalPlayers: number): string {
  const id = randomUUID()
  WebhookSource.createCapture({
    id,
    gameId: id,
    session,
    totalPlayers,
    sourceGame: 'turbo',
    pluginName: 'TM Webhooks',
    pluginVersion: '1.0.0',
  })
  return id
}

async function queue(socket: TypedSocket, session: string) {
  const details = await TournamentManager.onGet(socket, { session })
  assertResponse(details)
  return getSessionQueue(
    session,
    await MatchManager.getAllMatches(),
    await TimeEntryManager.getAllTimeEntries(),
    details.details ?? undefined,
    ActiveEntryManager.getOverrides()[session]
  )
}

function ids(entries: (QueuedEntry | undefined)[]): (string | undefined)[] {
  return entries.map(entry => entry?.entry.id)
}

function setActive(
  socket: TypedSocket,
  session: string,
  entry: EntryRef | null
) {
  return ActiveEntryManager.onSetActiveEntry(socket, {
    type: 'SetActiveEntryRequest',
    session,
    entry,
  })
}

describe('set_active_entry', () => {
  test('moderators set and remove an override and broadcast it', async () => {
    const moderator = await login(createUser('now-mod', 'moderator'))
    const session = (await createSession(moderator, [])).id
    const match = await createMatch(moderator, session)

    assertResponse(
      await setActive(moderator, session, { kind: 'match', id: match.id })
    )
    expect(ActiveEntryManager.getOverrides()[session]).toEqual({
      kind: 'match',
      id: match.id,
    })
    expect(broadcast).toHaveBeenLastCalledWith(
      'active_entry_overrides',
      ActiveEntryManager.getOverrides()
    )

    assertResponse(await setActive(moderator, session, null))
    expect(ActiveEntryManager.getOverrides()[session]).toBeUndefined()
    expect(broadcast).toHaveBeenLastCalledWith(
      'active_entry_overrides',
      ActiveEntryManager.getOverrides()
    )
  })

  test('rejects users and entries that cannot be now', async () => {
    const player = createUser('now-player')
    const user = await login(player)
    const moderator = await login(createUser('now-mod-reject', 'moderator'))
    const session = (await createSession(moderator, [])).id
    const other = (await createSession(moderator, [])).id
    const planned = await createMatch(moderator, session)
    const elsewhere = await createMatch(moderator, other)
    const completed = await createLap(moderator, session, player.id)
    assertResponse(
      await TimeEntryManager.onEditTimeEntry(moderator, {
        type: 'EditTimeEntryRequest',
        id: completed.id,
        duration: 10000,
      })
    )
    const deleted = await createMatch(moderator, session)
    assertResponse(
      await MatchManager.onDeleteMatch(moderator, {
        type: 'DeleteMatchRequest',
        id: deleted.id,
      })
    )

    await assert.rejects(
      setActive(user, session, { kind: 'match', id: planned.id })
    )
    for (const entry of [
      { kind: 'match', id: elsewhere.id },
      { kind: 'timeEntry', id: completed.id },
      { kind: 'match', id: deleted.id },
      { kind: 'timeEntry', id: planned.id },
    ] satisfies EntryRef[])
      await assert.rejects(setActive(moderator, session, entry))

    assertResponse(
      await SessionManager.onEditSession(moderator, {
        type: 'EditSessionRequest',
        id: session,
        status: 'cancelled',
      })
    )
    await assert.rejects(
      setActive(moderator, session, { kind: 'match', id: planned.id })
    )
    expect(ActiveEntryManager.getOverrides()[session]).toBeUndefined()
  })
})

describe('session queue', () => {
  test('orders webhook, then unplayed session entries by creation', async () => {
    const player = createUser('now-queue-player')
    const moderator = await login(createUser('now-queue-mod', 'moderator'))
    const session = (await createSession(moderator, [])).id

    const firstLap = await createLap(moderator, session, player.id)
    const draft = await createMatch(moderator, session, { status: 'draft' })
    const started = await createMatch(moderator, session, {
      status: 'in_progress',
    })
    const secondLap = await createLap(moderator, session, player.id)
    const live = await createMatch(moderator, session, {
      status: 'in_progress',
      webhookCapture: createCapture(session, 2),
    })

    const result = await queue(moderator, session)
    expect(result.now).toMatchObject({ kind: 'match', source: 'webhook' })
    expect(ids([result.now, ...result.next])).toEqual([
      live.id,
      firstLap.id,
      started.id,
      secondLap.id,
    ])
    expect(ids(result.next)).not.toContain(draft.id)
  })

  test('an override wins until its entry is played', async () => {
    const player = createUser('now-override-player')
    const moderator = await login(createUser('now-override-mod', 'moderator'))
    const session = (await createSession(moderator, [])).id
    const first = await createLap(moderator, session, player.id)
    const second = await createMatch(moderator, session)
    const third = await createLap(moderator, session, player.id)

    assertResponse(
      await setActive(moderator, session, { kind: 'timeEntry', id: third.id })
    )
    let result = await queue(moderator, session)
    expect(result.now).toMatchObject({ source: 'override' })
    expect(ids([result.now, ...result.next])).toEqual([
      third.id,
      first.id,
      second.id,
    ])

    assertResponse(
      await TimeEntryManager.onEditTimeEntry(moderator, {
        type: 'EditTimeEntryRequest',
        id: third.id,
        duration: 12000,
      })
    )
    result = await queue(moderator, session)
    expect(result.now).toMatchObject({ source: 'session' })
    expect(ids([result.now, ...result.next])).toEqual([first.id, second.id])
  })
})

describe('tournament queue', () => {
  test.serial(
    'plays ready matches before tie-breakers, then falls through to the session',
    async () => {
      const players = Array.from({ length: 12 }, (_, index) =>
        createUser(
          `nq-${String(index).padStart(2, '0')}`,
          index === 0 ? 'admin' : 'user',
          `nq-${String(index).padStart(2, '0')}`
        )
      )
      const socket = await login(players[0])
      const tracks = createTracks(1)
      const session = (
        await createSession(
          socket,
          await createRsvps({ yes: players.length, no: 0, maybe: 0 }, players)
        )
      ).id
      const config: TournamentConfig = {
        groupsCount: 4,
        advancementCount: 1,
        eliminationType: 'single',
        session,
        owner: players[0].id,
        previewVisibility: 'visible',
        stageTracks: {},
        tieBreakerTrack: tracks[0].id,
      }
      for (const stage of getTournamentStages(config, players.length))
        config.stageTracks[stage] = [tracks[0].id]
      const draft = await TournamentManager.onCreate(socket, { session })
      assertResponse(draft)
      assert(draft.details?.configKey)
      const saved = await TournamentManager.onUpdate(socket, {
        config,
        configKey: draft.details.configKey,
      })
      assertResponse(saved)
      assert(saved.details?.previewKey)

      const standalone = await createMatch(socket, session)
      expect(ids([(await queue(socket, session)).now])).toEqual([standalone.id])

      assertResponse(
        await TournamentManager.onStart(socket, {
          session,
          previewKey: saved.details.previewKey,
        })
      )
      const details = async () => {
        const response = await TournamentManager.onGet(socket, { session })
        assertResponse(response)
        assert(response.details)
        return response.details
      }
      const complete = async (match: Match, winner: string | null) =>
        assertResponse(
          await MatchManager.onEditMatch(socket, {
            type: 'EditMatchRequest',
            id: match.id,
            status: 'completed',
            winner,
          })
        )

      const groupMatches = (await details()).matches.filter(
        match => match.stage === 'group'
      )
      let result = await queue(socket, session)
      expect(result.now).toMatchObject({
        source: 'tournament',
        entry: { id: groupMatches[0].id },
      })
      expect(ids(result.next).at(-1)).toBe(standalone.id)

      const [circleGroup] = (await details()).groups
      for (const match of groupMatches) {
        assert(match.user1 && match.user2)
        if (match.tournament?.groupId !== circleGroup.id) {
          await complete(match, [match.user1, match.user2].toSorted()[0])
          continue
        }
        const circle = [
          ...new Set(
            groupMatches
              .filter(m => m.tournament?.groupId === circleGroup.id)
              .flatMap(m => [m.user1, m.user2])
          ),
        ]
        const beatsNext =
          circle.indexOf(match.user2) ===
          (circle.indexOf(match.user1) + 1) % circle.length
        await complete(match, beatsNext ? match.user1 : match.user2)
      }

      const tieBreakers = (await details()).tieBreakers
      const required = tieBreakers.filter(lap => lap.required)
      const optional = tieBreakers.filter(lap => !lap.required)
      expect(required.length).toBeGreaterThan(0)
      const expectLaps = (laps: (string | undefined)[]) => {
        const split = required.length
        expect(laps.slice(0, split).toSorted()).toEqual(
          required.map(lap => lap.id).toSorted()
        )
        expect(laps.slice(split).toSorted()).toEqual(
          optional.map(lap => lap.id).toSorted()
        )
      }
      result = await queue(socket, session)
      const order = [result.now, ...result.next]
      const firstLap = order.findIndex(entry => entry?.kind === 'timeEntry')
      expect(firstLap).toBeGreaterThan(0)
      expect(
        order.slice(0, firstLap).every(entry => entry?.kind === 'match')
      ).toBe(true)
      expectLaps(ids(order.slice(firstLap, -1)))
      expect(order.at(-1)?.entry.id).toBe(standalone.id)

      while (result.now?.source === 'tournament' && result.now.kind === 'match')
        await complete(
          result.now.entry,
          [result.now.entry.user1, result.now.entry.user2].toSorted()[0]
        ).then(async () => {
          result = await queue(socket, session)
        })

      expect(result.now).toMatchObject({
        kind: 'timeEntry',
        source: 'tournament',
      })
      const finalOrder = ids([result.now, ...result.next])
      expectLaps(finalOrder.slice(0, -1))
      expect(finalOrder.at(-1)).toBe(standalone.id)
    }
  )
})
