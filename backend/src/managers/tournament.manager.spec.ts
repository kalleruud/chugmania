import loc from '@common/locale/locales'
import type { Match } from '@common/models/match'
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@common/models/socket.io'
import type { EditTimeEntryRequest } from '@common/models/timeEntry'
import type {
  Slot,
  TournamentChange,
  TournamentConfig,
  TournamentDetails,
} from '@common/models/tournament'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import jwt from 'jsonwebtoken'
import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { io, type Socket } from 'socket.io-client'
import * as schema from '../../database/schema'

type Client = Socket<ServerToClientEvents, ClientToServerEvents>

async function freePort(): Promise<number> {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  await new Promise<void>((resolve, reject) =>
    server.close(error => (error ? reject(error) : resolve()))
  )
  return address.port
}

function parity(details: TournamentDetails) {
  function dependency(slot: Slot) {
    if (slot.kind === 'group_rank')
      return {
        ...slot,
        groupId: details.groups.find(g => g.id === slot.groupId)?.name,
      }
    if (slot.kind === 'match_winner' || slot.kind === 'match_loser')
      return {
        ...slot,
        matchId: details.matches.findIndex(m => m.id === slot.matchId),
      }
    return slot
  }
  return {
    qualification: details.qualification.map(
      ({ groupId, sourceEntry: ignoredSourceEntry, ...p }) => ({
        ...p,
        group: details.groups.find(g => g.id === groupId)?.name,
      })
    ),
    groups: details.groups.map(({ id, ...g }) => g),
    matches: details.matches.map(
      ({ id, createdAt, updatedAt, tournament, ...m }) => ({
        ...m,
        tournament: tournament && {
          ...tournament,
          id: '',
          readOnly: false,
          dependencies: {
            slot1: dependency(tournament.dependencies.slot1),
            slot2: dependency(tournament.dependencies.slot2),
          },
        },
      })
    ),
    workload: details.workloadSummary,
    progress: details.progress,
  }
}

test(
  'real tournament commands, persistence, permissions and multiple clients',
  { timeout: 90000 },
  async t => {
    const folder = mkdtempSync(path.join(tmpdir(), 'tournament-command-'))
    const databasePath = path.join(folder, 'test.sqlite')
    const sqlite = new Database(databasePath)
    const db = drizzle(sqlite, { schema })
    migrate(db, { migrationsFolder: 'drizzle' })
    const passwordHash = createHash('sha512').update('test-password').digest()
    const people = Array.from({ length: 12 }, (_, index) => ({
      id: randomUUID(),
      email: `player-${index}@example.test`,
      firstName: `Player ${index}`,
      role: index === 0 ? 'admin' : 'user',
      passwordHash,
    }))
    for (const person of people)
      db.insert(schema.users)
        .values({ ...person, role: person.role === 'admin' ? 'admin' : 'user' })
        .run()
    const track = randomUUID()
    const secondTrack = randomUUID()
    db.insert(schema.tracks)
      .values([
        { id: track, number: 1, level: 'white', type: 'stadium' },
        { id: secondTrack, number: 2, level: 'green', type: 'valley' },
      ])
      .run()
    const session = randomUUID()
    db.insert(schema.sessions)
      .values({
        id: session,
        name: 'Integration Cup',
        date: new Date(Date.now() + 86400000),
      })
      .run()
    for (const player of people.slice(0, 8))
      db.insert(schema.sessionSignups)
        .values({ session, user: player.id, response: 'yes' })
        .run()
    for (const [index, player] of people.slice(0, 4).entries())
      db.insert(schema.timeEntries)
        .values({
          user: player.id,
          session,
          track,
          duration: 1000 + index * 10,
        })
        .run()
    const oldDraft = randomUUID()
    db.insert(schema.timeEntries)
      .values({
        id: oldDraft,
        user: people[4].id,
        session,
        track,
        draft: true,
        deletedAt: new Date(),
      })
      .run()
    const port = await freePort()
    const secret = randomUUID()
    let processHandle: ChildProcess | undefined
    let output = ''
    function start() {
      const child = spawn(
        process.execPath,
        ['--import', 'tsx', 'backend/src/server.ts'],
        {
          env: {
            ...process.env,
            NODE_ENV: 'production',
            DATABASE_PATH: databasePath,
            PORT: String(port),
            ORIGIN: `http://127.0.0.1:${port}`,
            SECRET: secret,
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      )
      child.stdout.on('data', (chunk: Buffer) => {
        output += chunk.toString()
      })
      child.stderr.on('data', (chunk: Buffer) => {
        output += chunk.toString()
      })
      return child
    }
    const clients: Client[] = []
    async function connect(user: string): Promise<Client> {
      const client: Client = io(`http://127.0.0.1:${port}`, {
        auth: { token: jwt.sign({ userId: user }, secret) },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 50,
        timeout: 3000,
      }).timeout(5000)
      clients.push(client)
      await Promise.race([
        new Promise<void>(resolve =>
          client.once('all_matches', () => resolve())
        ),
        new Promise<never>((_, reject) => {
          const timer = setTimeout(() => reject(new Error(output)), 10000)
          timer.unref()
        }),
      ])
      return client
    }
    t.after(async () => {
      clients.forEach(client => client.disconnect())
      if (processHandle && processHandle.exitCode === null) {
        processHandle.kill()
        await once(processHandle, 'exit')
      }
      sqlite.close()
      rmSync(folder, { recursive: true, force: true })
    })
    processHandle = start()
    const admin = await connect(people[0].id)
    const viewer = await connect(people[1].id)
    const changes: TournamentChange[] = []
    viewer.on('tournament_changed', change => changes.push(change))
    const watched = await viewer.emitWithAck('get_tournament', { session })
    assert.ok(watched.success)
    const config: TournamentConfig = {
      session,
      qualificationTrack: track,
      groupsCount: 2,
      advancementCount: 2,
      eliminationType: 'single',
      stageTracks: {
        group: [track, secondTrack],
        semi: [track],
        final: [secondTrack],
      },
    }
    async function details(): Promise<TournamentDetails> {
      const response = await admin.emitWithAck('get_tournament', { session })
      assert.ok(response.success, JSON.stringify(response))
      assert.ok(response.details)
      return response.details
    }
    async function result(
      match: Match,
      status: 'planned' | 'completed' | 'cancelled',
      winner: string | null
    ) {
      const response = await admin.emitWithAck('edit_match', {
        type: 'EditMatchRequest',
        id: match.id,
        status,
        winner,
      })
      assert.ok(response.success, JSON.stringify(response))
    }
    await t.test(
      'preview never persists; saved structure agrees; permissions and concurrent creation',
      async () => {
        const forbidden = await viewer.emitWithAck('create_tournament', config)
        assert.equal(forbidden.success, false)
        const databaseBeforePreview = sqlite.serialize()
        let timeEntryBroadcasts = 0
        const onTimeEntries = () => timeEntryBroadcasts++
        admin.on('all_time_entries', onTimeEntries)
        const preview = await admin.emitWithAck('preview_tournament', config)
        assert.ok(preview.success, JSON.stringify(preview))
        assert.equal(preview.details.qualificationEntries.length, 8)
        const previewDrafts = preview.details.qualificationEntries.filter(
          entry => entry.draft
        )
        assert.equal(previewDrafts.length, 4)
        assert.ok(
          previewDrafts.every(
            entry =>
              entry.id.startsWith('preview:') &&
              entry.duration === null &&
              entry.session === session &&
              entry.track === track
          )
        )
        assert.ok(
          preview.details.qualification
            .filter(player => player.duration === null)
            .every(player => player.sourceEntry === null)
        )
        const repeatedPreview = await admin.emitWithAck(
          'preview_tournament',
          config
        )
        assert.ok(repeatedPreview.success)
        assert.deepEqual(
          repeatedPreview.details.qualificationEntries.map(entry => entry.id),
          preview.details.qualificationEntries.map(entry => entry.id)
        )
        const changedPreview = await admin.emitWithAck('preview_tournament', {
          ...config,
          qualificationTrack: secondTrack,
        })
        assert.ok(changedPreview.success)
        assert.equal(changedPreview.details.qualificationEntries.length, 8)
        assert.ok(
          changedPreview.details.qualificationEntries.every(
            entry => entry.draft && entry.track === secondTrack
          )
        )
        const invalidPreview = await admin.emitWithAck('preview_tournament', {
          ...config,
          qualificationTrack: '',
        })
        assert.equal(invalidPreview.success, false)
        assert.deepEqual(sqlite.serialize(), databaseBeforePreview)
        assert.equal(timeEntryBroadcasts, 0)
        admin.off('all_time_entries', onTimeEntries)
        const created = await Promise.all([
          admin.emitWithAck('create_tournament', config),
          admin.emitWithAck('create_tournament', config),
        ])
        assert.equal(created.filter(r => r.success).length, 1)
        assert.deepEqual(parity(await details()), parity(preview.details))
        assert.equal((await details()).qualificationEntries.length, 8)
        const drafts = db
          .select()
          .from(schema.timeEntries)
          .all()
          .filter(entry => entry.draft && !entry.deletedAt)
        assert.equal(drafts.length, 4)
        assert.ok(drafts.some(entry => entry.user === people[4].id))
        assert.ok(
          db
            .select()
            .from(schema.timeEntries)
            .all()
            .find(entry => entry.id === oldDraft)?.deletedAt
        )
        assert.ok(drafts.every(entry => !entry.id.startsWith('preview:')))
        assert.ok(
          (await details()).qualification
            .filter(player => player.duration === null)
            .every(player => player.sourceEntry)
        )

        const completedDraft = await admin.emitWithAck('edit_time_entry', {
          type: 'EditTimeEntryRequest',
          id: drafts[0].id,
          duration: 1500,
        })
        assert.ok(completedDraft.success)
        assert.equal(
          db
            .select()
            .from(schema.timeEntries)
            .all()
            .find(entry => entry.id === drafts[0].id)?.draft,
          false
        )
        const cancelledDraft = await admin.emitWithAck('edit_time_entry', {
          type: 'EditTimeEntryRequest',
          id: drafts[1].id,
          deletedAt: new Date(),
        })
        assert.ok(cancelledDraft.success)
        assert.equal(
          (await details()).qualification.find(
            player => player.user === drafts[1].user
          )?.sourceEntry,
          null
        )
        const previewAfterCancel = await admin.emitWithAck(
          'preview_tournament',
          config
        )
        assert.ok(previewAfterCancel.success)
        assert.ok(
          previewAfterCancel.details.qualificationEntries.every(
            entry => entry.user !== drafts[1].user
          )
        )
        assert.equal(
          db
            .select()
            .from(schema.timeEntries)
            .all()
            .filter(entry => entry.user === drafts[1].user && entry.draft)
            .length,
          1
        )
        assert.ok(
          changes.some(change => change.details?.config.session === session)
        )
        const unresolved = (await details()).matches.find(m => !m.user1)
        assert.ok(unresolved)
        const invalid = await admin.emitWithAck('edit_match', {
          type: 'EditMatchRequest',
          id: unresolved.id,
          status: 'completed',
          winner: people[0].id,
        })
        assert.equal(invalid.success, false)
      }
    )
    await t.test(
      'qualification regeneration preserves retained records and tracks',
      async () => {
        const before = await details()
        const retained = before.matches.filter(m => m.stage === 'group')
        const posted = await admin.emitWithAck('post_time_entry', {
          type: 'CreateTimeEntryRequest',
          user: people[0].id,
          session,
          track,
          duration: 999,
        })
        assert.ok(posted.success)
        const after = await details()
        for (const match of retained) {
          const same = after.matches.find(
            m =>
              m.user1 === match.user1 &&
              m.user2 === match.user2 &&
              m.stage === 'group'
          )
          assert.equal(same?.id, match.id)
          assert.equal(same.track, match.track)
        }
        assert.equal(
          after.qualification.find(p => p.user === people[0].id)?.duration,
          999
        )
      }
    )
    await t.test(
      'freeze locks qualification laps; late admission preserves fixtures; undo keeps qualification locked',
      async () => {
        const before = await details()
        const first = before.matches[0]
        await result(first, 'completed', first.user1)
        const frozen = await details()
        assert.ok(frozen.frozen)
        assert.deepEqual(frozen.qualification, before.qualification)
        const frozenEntries = db.select().from(schema.timeEntries).all()
        const lap = frozen.qualificationEntries[0]
        assert.ok(lap)
        const edits: Partial<EditTimeEntryRequest>[] = [
          { duration: 1 },
          { deletedAt: new Date() },
          { session: null },
          { track: secondTrack },
        ]
        for (const edit of edits) {
          const response = await admin.emitWithAck('edit_time_entry', {
            ...edit,
            type: 'EditTimeEntryRequest',
            id: lap.id,
          })
          assert.equal(response.success, false)
          assert.equal(response.message, loc.no.tournament.qualificationLocked)
        }
        const posted = await admin.emitWithAck('post_time_entry', {
          type: 'CreateTimeEntryRequest',
          user: people[0].id,
          session,
          track,
          duration: 1,
        })
        assert.equal(posted.success, false)
        assert.equal(posted.message, loc.no.tournament.qualificationLocked)
        assert.deepEqual(
          db.select().from(schema.timeEntries).all(),
          frozenEntries
        )
        const otherTrack = await admin.emitWithAck('post_time_entry', {
          type: 'CreateTimeEntryRequest',
          user: people[0].id,
          session,
          track: secondTrack,
          duration: 1234,
        })
        assert.ok(otherTrack.success)
        const ordinaryLap = db
          .select()
          .from(schema.timeEntries)
          .all()
          .find(entry => entry.track === secondTrack)
        assert.ok(ordinaryLap)
        const moved = await admin.emitWithAck('edit_time_entry', {
          type: 'EditTimeEntryRequest',
          id: ordinaryLap.id,
          track,
        })
        assert.equal(moved.success, false)
        assert.equal(moved.message, loc.no.tournament.qualificationLocked)
        const ordinaryEdit = await admin.emitWithAck('edit_time_entry', {
          type: 'EditTimeEntryRequest',
          id: ordinaryLap.id,
          duration: 1235,
        })
        assert.ok(ordinaryEdit.success)
        assert.deepEqual((await details()).qualification, frozen.qualification)
        const admission = await admin.emitWithAck('rsvp_session', {
          type: 'RsvpSessionRequest',
          session,
          user: people[8].id,
          response: 'yes',
        })
        assert.ok(admission.success, JSON.stringify(admission))
        const added = await details()
        assert.equal(added.qualification.length, 9)
        assert.equal(added.matches.length, frozen.matches.length + 4)
        for (const old of frozen.matches) {
          const same = added.matches.find(m => m.id === old.id)
          assert.ok(same)
          assert.equal(same.track, old.track)
          assert.equal(same.winner, old.winner)
        }
        const again = await admin.emitWithAck('rsvp_session', {
          type: 'RsvpSessionRequest',
          session,
          user: people[8].id,
          response: 'yes',
        })
        assert.ok(again.success)
        assert.equal((await details()).matches.length, added.matches.length)
        await result(first, 'planned', null)
        assert.ok((await details()).frozen)
      }
    )
    await t.test(
      'awards complete group play, close admission and protect decided downstream matches',
      async () => {
        for (const match of (await details()).matches.filter(
          m => m.stage === 'group'
        ))
          await result(match, 'cancelled', match.user1)
        const afterGroups = await details()
        assert.ok(
          afterGroups.matches
            .filter(m => m.stage === 'semi')
            .every(m => m.user1 && m.user2)
        )
        const admission = await admin.emitWithAck('rsvp_session', {
          type: 'RsvpSessionRequest',
          session,
          user: people[9].id,
          response: 'yes',
        })
        assert.ok(admission.success)
        assert.equal((await details()).qualification.length, 9)
        const semifinal = afterGroups.matches.find(m => m.stage === 'semi')
        assert.ok(semifinal)
        await result(semifinal, 'completed', semifinal.user1)
        const before = await details()
        const groupMatch = before.matches.find(m => m.stage === 'group')
        assert.ok(groupMatch)
        const bad = await admin.emitWithAck('edit_match', {
          type: 'EditMatchRequest',
          id: groupMatch.id,
          status: 'planned',
          winner: null,
        })
        assert.equal(bad.success, false)
        assert.deepEqual(await details(), before)
      }
    )
    await t.test(
      'session cancellation/restoration, restart, and deletion preserve intended history',
      async () => {
        const cancel = await admin.emitWithAck('edit_session', {
          type: 'EditSessionRequest',
          id: session,
          status: 'cancelled',
        })
        assert.ok(cancel.success)
        assert.ok((await details()).cancelled)
        const blocked = await admin.emitWithAck('edit_match', {
          type: 'EditMatchRequest',
          id: (await details()).matches[0].id,
          status: 'planned',
          winner: null,
        })
        assert.equal(blocked.success, false)
        const restore = await admin.emitWithAck('edit_session', {
          type: 'EditSessionRequest',
          id: session,
          status: 'confirmed',
        })
        assert.ok(restore.success)
        const before = await details()
        assert.ok(processHandle)
        processHandle.kill()
        await once(processHandle, 'exit')
        const reconnect = new Promise<void>(resolve =>
          admin.once('all_matches', () => resolve())
        )
        processHandle = start()
        await reconnect
        assert.deepEqual(await details(), before)
      }
    )
    await t.test(
      'CSV preserves every tournament table, JSON, snapshots and raw writes',
      async () => {
        const before = await details()
        const tables: (
          | 'tournaments'
          | 'tournamentStages'
          | 'tournamentGroups'
          | 'tournamentPlayers'
          | 'tournamentMatches'
        )[] = [
          'tournaments',
          'tournamentStages',
          'tournamentGroups',
          'tournamentPlayers',
          'tournamentMatches',
        ]
        for (const table of tables) {
          const exported = await admin.emitWithAck('export_csv', { table })
          assert.ok(exported.success, JSON.stringify(exported))
          const imported = await admin.emitWithAck('import_csv', {
            table,
            content: exported.csv,
          })
          assert.ok(imported.success, JSON.stringify(imported))
        }
        assert.deepEqual(parity(await details()), parity(before))
        const raw = await admin.emitWithAck('import_csv', {
          table: 'tournaments',
          content: `id,notReadyReason\n${before.id},Raw import marker`,
        })
        assert.ok(raw.success)
        assert.equal((await details()).notReadyReason, 'Raw import marker')
      }
    )
    await t.test(
      'deletion can keep or delete related results; unrelated records survive and invalid roster recovers',
      async () => {
        const ordinary = await admin.emitWithAck('create_match', {
          type: 'CreateMatchRequest',
          session,
          track,
          user1: people[0].id,
          user2: people[1].id,
        })
        assert.ok(ordinary.success)
        const originalLaps = db.select().from(schema.timeEntries).all()
        const originalMatches = db.select().from(schema.matches).all()
        const kept = await details()
        const denied = await viewer.emitWithAck('delete_tournament', {
          session,
          deleteRelatedResults: true,
        })
        assert.equal(denied.success, false)
        assert.ok((await details()).id)
        const deletion = await admin.emitWithAck('delete_tournament', {
          session,
          deleteRelatedResults: false,
        })
        assert.ok(deletion.success)
        const deleted = await admin.emitWithAck('get_tournament', { session })
        assert.ok(deleted.success)
        assert.equal(deleted.details, null)
        assert.deepEqual(
          db.select().from(schema.timeEntries).all(),
          originalLaps
        )
        assert.deepEqual(
          db
            .select()
            .from(schema.matches)
            .all()
            .map(({ updatedAt: ignored, ...match }) => match),
          originalMatches.map(({ updatedAt: ignored, ...match }) => {
            if (
              !match.deletedAt &&
              match.status === 'cancelled' &&
              match.winner &&
              kept.matches.some(fixture => fixture.id === match.id)
            )
              return { ...match, status: 'completed' }
            return match
          })
        )
        const retainedEdit = await admin.emitWithAck('edit_match', {
          type: 'EditMatchRequest',
          id: kept.matches[0].id,
          comment: 'Kept match is editable',
        })
        assert.ok(retainedEdit.success)
        assert.ok(
          db
            .select()
            .from(schema.matches)
            .all()
            .some(m => !m.deletedAt)
        )
        const created = await admin.emitWithAck('create_tournament', config)
        assert.ok(created.success, JSON.stringify(created))
        const removed = await details()
        const removeResults = await admin.emitWithAck('delete_tournament', {
          session,
          deleteRelatedResults: true,
        })
        assert.ok(removeResults.success)
        const remainingMatches = db.select().from(schema.matches).all()
        assert.ok(
          remainingMatches
            .filter(match =>
              removed.matches.some(fixture => fixture.id === match.id)
            )
            .every(match => match.deletedAt)
        )
        assert.ok(
          remainingMatches.find(
            match => match.id === kept.matches[0].id && !match.deletedAt
          )
        )
        assert.ok(
          remainingMatches.some(
            match =>
              !match.deletedAt &&
              !kept.matches.some(fixture => fixture.id === match.id)
          )
        )
        const remainingLaps = db.select().from(schema.timeEntries).all()
        assert.ok(
          remainingLaps
            .filter(entry =>
              removed.qualificationEntries.some(lap => lap.id === entry.id)
            )
            .every(entry => entry.deletedAt)
        )
        assert.deepEqual(
          remainingLaps.filter(entry => entry.track === secondTrack),
          originalLaps.filter(entry => entry.track === secondTrack)
        )
        const recreated = await admin.emitWithAck('create_tournament', config)
        assert.ok(recreated.success)
        for (const person of people.slice(3, 10)) {
          const response = await admin.emitWithAck('rsvp_session', {
            type: 'RsvpSessionRequest',
            session,
            user: person.id,
            response: 'no',
          })
          assert.ok(response.success)
        }
        assert.ok((await details()).notReadyReason)
        const response = await admin.emitWithAck('rsvp_session', {
          type: 'RsvpSessionRequest',
          session,
          user: people[3].id,
          response: 'yes',
        })
        assert.ok(response.success)
        assert.equal((await details()).notReadyReason, null)
        assert.equal((await details()).qualification.length, 4)
        const cascade = await admin.emitWithAck('delete_session', {
          type: 'DeleteSessionRequest',
          id: session,
        })
        assert.ok(cascade.success)
        assert.ok(
          db
            .select()
            .from(schema.tournaments)
            .all()
            .every(row => row.deletedAt)
        )
      }
    )
  }
)
