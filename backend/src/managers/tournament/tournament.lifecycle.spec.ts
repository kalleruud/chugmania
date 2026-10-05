import type {
  TournamentConfig,
  TournamentDetails,
} from '@common/models/tournament'
import { getTournamentStages } from '@common/utils/tournament'
import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { db } from '../../../../tests/setup'
import {
  assertResponse,
  createRsvps,
  createSession,
  createTracks,
  createUser,
  login,
} from '../../../../tests/utils'
import {
  matches,
  tournamentGroups,
  tournamentMatches,
  tournamentMatchSlots,
  tournamentPlayers,
  tracks,
} from '../../../database/schema'
import TournamentSource from '../../../database/tournament.source'
import { broadcast } from '../../server'
import AdminManager from '../admin.manager'
import MatchManager from '../match.manager'
import SessionManager from '../session.manager'
import TimeEntryManager from '../timeEntry.manager'
import UserManager from '../user.manager'
import TournamentManager from './tournament.manager'

async function fixture(count = 4) {
  const suffix = randomUUID()
  const admin = createUser(`admin-${suffix}`, 'admin')
  const moderator = createUser(`moderator-${suffix}`, 'moderator')
  const players = Array.from({ length: Math.max(count, 6) }, (_, index) =>
    createUser(`player-${index}-${suffix}`)
  )
  const socket = await login(admin)
  const moderatorSocket = await login(moderator)
  const viewer = await login(players[0])
  const selectedTracks = createTracks(2)
  const session = await createSession(
    socket,
    await createRsvps({ yes: count, no: 0, maybe: 0 }, players)
  )
  const created = await TournamentManager.onCreate(socket, {
    session: session.id,
  })
  assertResponse(created)
  assert(created.details)
  const draft = created.details
  async function save(config: TournamentConfig) {
    const details = TournamentManager.getDetails(session.id)
    assert(details?.configKey)
    const response = await TournamentManager.onUpdate(socket, {
      config,
      configKey: details.configKey,
    })
    assertResponse(response)
    assert(response.details)
    return response.details
  }
  async function ready() {
    const stageTracks = Object.fromEntries(
      getTournamentStages(draft.config, count).map(stage => [
        stage,
        selectedTracks.map(track => track.id),
      ])
    )
    return save({
      ...draft.config,
      stageTracks,
      tieBreakerTrack: selectedTracks[0].id,
    })
  }
  return {
    socket,
    moderatorSocket,
    viewer,
    players,
    selectedTracks,
    session,
    draft,
    save,
    ready,
  }
}

function graphCounts(session: string, tournament: string) {
  return {
    groups: db
      .select()
      .from(tournamentGroups)
      .where(eq(tournamentGroups.tournament, tournament))
      .all().length,
    players: db
      .select()
      .from(tournamentPlayers)
      .where(eq(tournamentPlayers.tournament, tournament))
      .all().length,
    fixtures: db
      .select()
      .from(tournamentMatches)
      .where(eq(tournamentMatches.tournament, tournament))
      .all().length,
    slots: db
      .select()
      .from(tournamentMatchSlots)
      .innerJoin(
        tournamentMatches,
        eq(tournamentMatches.id, tournamentMatchSlots.tournamentMatch)
      )
      .where(eq(tournamentMatches.tournament, tournament))
      .all().length,
    matches: db.select().from(matches).where(eq(matches.session, session)).all()
      .length,
  }
}

function draw(details: TournamentDetails) {
  return {
    config: details.config,
    groups: details.groups.map(group => ({
      name: group.name,
      position: group.position,
      users: details.participants
        .filter(player => player.groupId === group.id)
        .map(player => player.user),
    })),
    participants: details.participants.map(player => ({
      user: player.user,
      rating: player.rating,
      admission: player.admission,
    })),
    matches: details.matches.map(match => ({
      stage: match.stage,
      user1: match.user1,
      user2: match.user2,
      track: match.track,
      slot1: match.tournament?.slot1,
      slot2: match.tournament?.slot2,
      label: match.tournament?.label,
    })),
  }
}

const emptyGraph = { groups: 0, players: 0, fixtures: 0, slots: 0, matches: 0 }

describe('Tournament preparation lifecycle', () => {
  test.serial(
    'creates and saves before four signups without persisting a draw',
    async () => {
      const f = await fixture(0)
      expect(f.draft).toMatchObject({
        status: 'draft',
        frozen: false,
        matches: [],
        standings: [],
        completed: false,
        workloadSummary: { tracks: 0, minMatches: 0, maxMatches: 0 },
      })
      expect(f.draft.groups).toHaveLength(1)
      expect(f.draft.groups[0].standings).toEqual([])
      expect(f.draft.notReadyReason).toBe('Awaiting signups')
      expect(f.draft.config).toEqual({
        session: f.session.id,
        groupsCount: 1,
        advancementCount: 2,
        eliminationType: 'single',
        stageTracks: {},
        tieBreakerTrack: null,
      })
      expect(graphCounts(f.session.id, f.draft.id)).toEqual(emptyGraph)
      const saved = await f.save({ ...f.draft.config, groupsCount: 2 })
      expect(saved.config.groupsCount).toBe(2)
      expect(saved.groups).toHaveLength(2)
      expect(saved.notReadyReason).toBe('Awaiting signups')
      expect(graphCounts(f.session.id, f.draft.id)).toEqual(emptyGraph)
      assert(saved.previewKey)
      await assert.rejects(
        TournamentManager.onStart(f.socket, {
          session: f.session.id,
          previewKey: saved.previewKey,
        })
      )
      expect(graphCounts(f.session.id, f.draft.id)).toEqual(emptyGraph)
      await assert.rejects(
        TournamentManager.onCreate(f.socket, { session: f.session.id })
      )
    }
  )

  test.serial(
    'shows configured groups and incoming signups before brackets can be generated',
    async () => {
      const f = await fixture(0)
      const config = {
        ...f.draft.config,
        groupsCount: 4,
        advancementCount: 2,
        tieBreakerTrack: f.selectedTracks[0].id,
        stageTracks: {
          group: [f.selectedTracks[0].id],
          quarter: [f.selectedTracks[0].id],
          semi: [f.selectedTracks[0].id],
          final: [f.selectedTracks[0].id],
        },
      }
      const saved = await f.save(config)
      expect(saved.groups).toHaveLength(4)
      expect(saved.matches).toEqual([])
      expect(saved.notReadyReason).toBe('Awaiting signups')
      await f.save({ ...config, advancementCount: 7 })
      expect(
        TournamentManager.getDetails(f.session.id)?.config.advancementCount
      ).toBe(7)
      await f.save(config)
      for (const player of f.players) {
        assertResponse(
          await SessionManager.onRsvpSession(f.socket, {
            type: 'RsvpSessionRequest',
            session: f.session.id,
            user: player.id,
            response: 'yes',
          })
        )
      }
      const partial = TournamentManager.getDetails(f.session.id)
      assert(partial)
      expect(partial.groups).toHaveLength(4)
      expect(partial.groups.flatMap(group => group.standings)).toHaveLength(6)
      expect(partial.matches).toEqual([])
      expect(partial.notReadyReason).toBe('Awaiting signups')
      const ready = await f.save({ ...config, groupsCount: 2 })
      expect(ready.groups).toHaveLength(2)
      expect(ready.matches.length).toBeGreaterThan(0)
      expect(ready.notReadyReason).toBeNull()
      expect(graphCounts(f.session.id, f.draft.id)).toEqual(emptyGraph)
    }
  )

  test.serial(
    'requires an available tie-breaker track before start and keeps group renaming',
    async () => {
      const f = await fixture()
      const ready = await f.ready()
      const missing = await f.save({ ...ready.config, tieBreakerTrack: null })
      assert(missing.previewKey)
      expect(missing.notReadyReason).toBeTruthy()
      await assert.rejects(
        TournamentManager.onStart(f.socket, {
          session: f.session.id,
          previewKey: missing.previewKey,
        })
      )
      expect(graphCounts(f.session.id, f.draft.id)).toEqual(emptyGraph)
      await assert.rejects(
        TournamentManager.onRenameGroup(f.socket, {
          session: f.session.id,
          groupId: missing.groups[0].id,
          name: 'Draft group',
        })
      )
      const saved = await f.ready()
      assert(saved.previewKey)
      db.update(tracks)
        .set({ deletedAt: new Date() })
        .where(eq(tracks.id, f.selectedTracks[0].id))
        .run()
      const stale = await TournamentManager.onStart(f.socket, {
        session: f.session.id,
        previewKey: saved.previewKey,
      })
      assert(!stale.success && 'code' in stale)
      expect(stale.code).toBe('conflict')
      expect(graphCounts(f.session.id, f.draft.id)).toEqual(emptyGraph)
      db.update(tracks)
        .set({ deletedAt: null })
        .where(eq(tracks.id, f.selectedTracks[0].id))
        .run()
      const started = await TournamentManager.onStart(f.socket, {
        session: f.session.id,
        previewKey: saved.previewKey,
      })
      assertResponse(started)
      assert(started.details)
      expect(started.details.config.tieBreakerTrack).toBe(
        f.selectedTracks[0].id
      )
      const renamed = await TournamentManager.onRenameGroup(f.moderatorSocket, {
        session: f.session.id,
        groupId: started.details.groups[0].id,
        name: 'Merged group',
      })
      assertResponse(renamed)
      expect(renamed.details.groups[0].name).toBe('Merged group')
    }
  )

  test.serial(
    'does not accept internal persistence fields in configuration updates',
    async () => {
      const f = await fixture()
      assert(f.draft.configKey)
      const config = {
        ...f.draft.config,
        id: randomUUID(),
        status: 'started',
        deletedAt: new Date(),
      }
      const response = await TournamentManager.onUpdate(f.socket, {
        config,
        configKey: f.draft.configKey,
      })
      assertResponse(response)
      expect(response.details?.id).toBe(f.draft.id)
      expect(response.details?.status).toBe('draft')
      expect(
        TournamentSource.findActiveTournament(f.session.id)?.deletedAt
      ).toBeNull()
      expect(graphCounts(f.session.id, f.draft.id)).toEqual(emptyGraph)
    }
  )

  test.serial(
    'shares deterministic read-only previews and publishes signup changes',
    async () => {
      const f = await fixture()
      const preview = await f.ready()
      const fetched = await TournamentManager.onGet(f.viewer, {
        session: f.session.id,
      })
      assertResponse(fetched)
      expect(fetched.details).toEqual(preview)
      expect(TournamentManager.getDetails(f.session.id)).toEqual(preview)
      expect(preview.matches.every(match => match.tournament?.readOnly)).toBe(
        true
      )
      expect(graphCounts(f.session.id, f.draft.id)).toEqual(emptyGraph)
      await SessionManager.onRsvpSession(f.socket, {
        type: 'RsvpSessionRequest',
        session: f.session.id,
        user: f.players[4].id,
        response: 'yes',
      }).then(assertResponse)
      const updated = TournamentManager.getDetails(f.session.id)
      assert(updated)
      expect(updated.participants).toHaveLength(5)
      expect(updated.previewKey).not.toBe(preview.previewKey)
      expect(updated.configKey).toBe(preview.configKey)
      expect(broadcast).toHaveBeenCalledWith(
        'all_tournaments',
        TournamentManager.getAllTournaments(),
        f.socket.id
      )
      const ordinaryMatches = await MatchManager.getAllMatches()
      expect(
        ordinaryMatches.some(match =>
          updated.matches.some(previewMatch => match.id === previewMatch.id)
        )
      ).toBe(false)
    }
  )

  test.serial(
    'preserves configuration when cancellations invalidate the roster',
    async () => {
      const f = await fixture()
      const saved = await f.save({
        ...f.draft.config,
        groupsCount: 2,
        advancementCount: 2,
      })
      await SessionManager.onRsvpSession(f.socket, {
        type: 'RsvpSessionRequest',
        session: f.session.id,
        user: f.players[3].id,
        response: 'no',
      }).then(assertResponse)
      const invalid = TournamentManager.getDetails(f.session.id)
      assert(invalid?.previewKey)
      expect(invalid.config).toEqual(saved.config)
      expect(invalid.groups).toHaveLength(2)
      expect(invalid.matches).toHaveLength(0)
      expect(invalid.standings).toHaveLength(0)
      expect(invalid.notReadyReason).toBeTruthy()
      expect(invalid.workloadSummary).toEqual({
        tracks: 0,
        minMatches: 0,
        maxMatches: 0,
      })
      await assert.rejects(
        TournamentManager.onStart(f.socket, {
          session: f.session.id,
          previewKey: invalid.previewKey,
        })
      )
      await SessionManager.onRsvpSession(f.socket, {
        type: 'RsvpSessionRequest',
        session: f.session.id,
        user: f.players[3].id,
        response: 'yes',
      }).then(assertResponse)
      expect(TournamentManager.getDetails(f.session.id)?.groups).toHaveLength(2)
    }
  )

  test.serial(
    'keeps missing-track previews structural and preserves unused selections',
    async () => {
      const f = await fixture()
      expect(f.draft.matches.length).toBeGreaterThan(0)
      expect(f.draft.notReadyReason).toBeTruthy()
      const saved = await f.save({
        ...f.draft.config,
        stageTracks: { grand_final: [f.selectedTracks[0].id] },
      })
      expect(saved.config.stageTracks.grand_final).toEqual([
        f.selectedTracks[0].id,
      ])
      const cleared = await f.save({ ...saved.config, stageTracks: {} })
      expect(cleared.config.stageTracks).toEqual({})
      const restored = await f.save(saved.config)
      expect(restored.config.stageTracks).toEqual(saved.config.stageTracks)
      expect(graphCounts(f.session.id, f.draft.id)).toEqual(emptyGraph)
      const ready = await f.ready()
      db.update(tracks)
        .set({ deletedAt: new Date() })
        .where(eq(tracks.id, f.selectedTracks[0].id))
        .run()
      const unavailable = TournamentManager.getDetails(f.session.id)
      assert(unavailable?.previewKey)
      expect(unavailable.previewKey).not.toBe(ready.previewKey)
      expect(unavailable.notReadyReason).toBeTruthy()
      expect(unavailable.matches.length).toBeGreaterThan(0)
      await assert.rejects(
        TournamentManager.onStart(f.socket, {
          session: f.session.id,
          previewKey: unavailable.previewKey,
        })
      )
    }
  )

  test.serial(
    'rejects stale saves and stale starts with fresh details and no graph writes',
    async () => {
      const f = await fixture()
      const ready = await f.ready()
      assert(ready.configKey && ready.previewKey)
      await f.save({ ...ready.config, groupsCount: 2, advancementCount: 1 })
      const save = await TournamentManager.onUpdate(f.moderatorSocket, {
        config: ready.config,
        configKey: ready.configKey,
      })
      expect(save).toMatchObject({
        success: false,
        code: 'conflict',
        details: TournamentManager.getDetails(f.session.id),
      })
      const start = await TournamentManager.onStart(f.moderatorSocket, {
        session: f.session.id,
        previewKey: ready.previewKey,
      })
      expect(start).toMatchObject({
        success: false,
        code: 'conflict',
        details: TournamentManager.getDetails(f.session.id),
      })
      expect(graphCounts(f.session.id, f.draft.id)).toEqual(emptyGraph)
    }
  )

  test.serial(
    'starts the reviewed draw once and freezes membership and ratings',
    async () => {
      const f = await fixture()
      const preview = await f.ready()
      assert(preview.previewKey)
      const responses = await Promise.all([
        TournamentManager.onStart(f.socket, {
          session: f.session.id,
          previewKey: preview.previewKey,
        }),
        TournamentManager.onStart(f.moderatorSocket, {
          session: f.session.id,
          previewKey: preview.previewKey,
        }),
      ])
      expect(responses.filter(response => response.success)).toHaveLength(1)
      expect(
        responses.filter(response => !response.success && 'code' in response)
      ).toHaveLength(1)
      const started = TournamentManager.getDetails(f.session.id)
      assert(started)
      expect(started.id).toBe(preview.id)
      expect(started.status).toBe('started')
      expect(started.frozen).toBe(true)
      expect(draw(started)).toEqual(draw(preview))
      expect(graphCounts(f.session.id, f.draft.id)).toEqual({
        groups: preview.groups.length,
        players: 4,
        fixtures: preview.matches.length,
        matches: preview.matches.length,
        slots: preview.matches.length * 2,
      })
      await SessionManager.onRsvpSession(f.socket, {
        type: 'RsvpSessionRequest',
        session: f.session.id,
        user: f.players[4].id,
        response: 'yes',
      }).then(assertResponse)
      await MatchManager.onCreateMatch(f.socket, {
        type: 'CreateMatchRequest',
        session: f.session.id,
        user1: f.players[0].id,
        user2: f.players[1].id,
        winner: f.players[1].id,
        status: 'completed',
        track: f.selectedTracks[0].id,
      }).then(assertResponse)
      expect(
        draw(TournamentManager.getDetails(f.session.id) ?? started)
      ).toEqual(draw(started))
      assert(preview.configKey)
      expect(
        await TournamentManager.onUpdate(f.socket, {
          config: preview.config,
          configKey: preview.configKey,
        })
      ).toMatchObject({ success: false, code: 'conflict' })
    }
  )

  test.serial(
    'publishes changed ratings and implicit signups and rejects old seeding',
    async () => {
      const f = await fixture()
      const preview = await f.ready()
      assert(preview.previewKey)
      await TimeEntryManager.onPostTimeEntry(f.socket, {
        type: 'CreateTimeEntryRequest',
        user: f.players[4].id,
        session: f.session.id,
        track: f.selectedTracks[0].id,
        duration: 1000,
      }).then(assertResponse)
      expect(
        TournamentManager.getDetails(f.session.id)?.participants
      ).toHaveLength(5)
      expect(broadcast).toHaveBeenCalledWith(
        'all_tournaments',
        TournamentManager.getAllTournaments(),
        f.socket.id
      )
      const beforeMatch = TournamentManager.getDetails(f.session.id)
      await MatchManager.onCreateMatch(f.socket, {
        type: 'CreateMatchRequest',
        session: f.session.id,
        user1: f.players[0].id,
        user2: f.players[1].id,
        winner: f.players[1].id,
        status: 'completed',
        track: f.selectedTracks[0].id,
      }).then(assertResponse)
      expect(TournamentManager.getDetails(f.session.id)?.previewKey).not.toBe(
        beforeMatch?.previewKey
      )
      expect(
        await TournamentManager.onStart(f.socket, {
          session: f.session.id,
          previewKey: preview.previewKey,
        })
      ).toMatchObject({ success: false, code: 'conflict' })
      const beforeDelete = TournamentManager.getDetails(f.session.id)
      await UserManager.onDeleteUser(f.socket, {
        type: 'DeleteUserRequest',
        id: f.players[0].id,
      }).then(assertResponse)
      expect(
        TournamentManager.getDetails(f.session.id)?.participants
      ).toHaveLength(4)
      expect(TournamentManager.getDetails(f.session.id)?.previewKey).not.toBe(
        beforeDelete?.previewKey
      )
      expect(broadcast).toHaveBeenCalledWith(
        'all_tournaments',
        TournamentManager.getAllTournaments(),
        f.socket.id
      )
      await UserManager.onEditUser(f.socket, {
        type: 'EditUserRequest',
        id: f.players[0].id,
        deletedAt: null,
      }).then(assertResponse)
      expect(
        TournamentManager.getDetails(f.session.id)?.participants
      ).toHaveLength(5)
      expect(broadcast).toHaveBeenCalledWith(
        'all_tournaments',
        TournamentManager.getAllTournaments(),
        f.socket.id
      )
    }
  )

  test.serial(
    'allows moderator controls, protects user controls, and deletes drafts',
    async () => {
      const f = await fixture()
      assert(f.draft.configKey && f.draft.previewKey)
      await assert.rejects(
        TournamentManager.onCreate(f.viewer, { session: f.session.id })
      )
      await assert.rejects(
        TournamentManager.onUpdate(f.viewer, {
          config: f.draft.config,
          configKey: f.draft.configKey,
        })
      )
      await assert.rejects(
        TournamentManager.onStart(f.viewer, {
          session: f.session.id,
          previewKey: f.draft.previewKey,
        })
      )
      await assert.rejects(
        TournamentManager.onDelete(f.viewer, {
          session: f.session.id,
          deleteRelatedResults: false,
        })
      )
      await TournamentManager.onUpdate(f.moderatorSocket, {
        config: f.draft.config,
        configKey: f.draft.configKey,
      }).then(assertResponse)
      await TournamentManager.onDelete(f.moderatorSocket, {
        session: f.session.id,
        deleteRelatedResults: false,
      }).then(assertResponse)
      expect(TournamentManager.getDetails(f.session.id)).toBeNull()
      expect(graphCounts(f.session.id, f.draft.id)).toEqual(emptyGraph)
      const recreated = await TournamentManager.onCreate(f.moderatorSocket, {
        session: f.session.id,
      })
      assertResponse(recreated)
      expect(recreated.details?.id).not.toBe(f.draft.id)
    }
  )

  test.serial(
    'retains cancelled drafts, blocks mutations, and supports reopening or deletion',
    async () => {
      const f = await fixture()
      const preview = await f.ready()
      assert(preview.configKey && preview.previewKey)
      await SessionManager.onEditSession(f.socket, {
        type: 'EditSessionRequest',
        id: f.session.id,
        status: 'cancelled',
      }).then(assertResponse)
      const fetched = await TournamentManager.onGet(f.viewer, {
        session: f.session.id,
      })
      assertResponse(fetched)
      expect(fetched.details).toMatchObject({
        status: 'draft',
        cancelled: true,
      })
      expect(
        fetched.details?.matches.every(match => match.tournament?.readOnly)
      ).toBe(true)
      await assert.rejects(
        TournamentManager.onUpdate(f.socket, {
          config: preview.config,
          configKey: preview.configKey,
        })
      )
      await assert.rejects(
        TournamentManager.onStart(f.socket, {
          session: f.session.id,
          previewKey: preview.previewKey,
        })
      )
      await SessionManager.onEditSession(f.socket, {
        type: 'EditSessionRequest',
        id: f.session.id,
        status: 'confirmed',
      }).then(assertResponse)
      expect(
        TournamentManager.getDetails(f.session.id)?.notReadyReason
      ).toBeNull()
      await SessionManager.onEditSession(f.socket, {
        type: 'EditSessionRequest',
        id: f.session.id,
        status: 'cancelled',
      }).then(assertResponse)
      await TournamentManager.onDelete(f.socket, {
        session: f.session.id,
        deleteRelatedResults: false,
      }).then(assertResponse)
      await assert.rejects(
        TournamentManager.onCreate(f.socket, { session: f.session.id })
      )
    }
  )

  test.serial('rolls back the entire graph if persistence fails', async () => {
    const f = await fixture()
    const ready = await f.ready()
    assert(ready.previewKey)
    db.run(
      "CREATE TRIGGER fail_tournament_start BEFORE INSERT ON tournament_groups BEGIN SELECT RAISE(ABORT, 'Test rollback'); END"
    )
    try {
      await assert.rejects(
        TournamentManager.onStart(f.socket, {
          session: f.session.id,
          previewKey: ready.previewKey,
        }),
        /Test rollback/
      )
      expect(TournamentManager.getDetails(f.session.id)).toEqual(ready)
      expect(graphCounts(f.session.id, f.draft.id)).toEqual(emptyGraph)
    } finally {
      db.run('DROP TRIGGER fail_tournament_start')
    }
  })

  test.serial(
    'round-trips drafts and defaults legacy CSV records to started',
    async () => {
      const f = await fixture()
      await f.ready()
      const exported = await AdminManager.onExportCsv(f.socket, {
        table: 'tournaments',
      })
      assertResponse(exported)
      expect(exported.csv).toContain('status')
      await AdminManager.onImportCsv(f.socket, {
        table: 'tournaments',
        content: exported.csv,
      }).then(assertResponse)
      expect(TournamentManager.getDetails(f.session.id)?.status).toBe('draft')
      const legacySession = await createSession(f.socket, [])
      const legacyId = randomUUID()
      await AdminManager.onImportCsv(f.socket, {
        table: 'tournaments',
        content: `id,session,createdAt,groupsCount,advancementCount,eliminationType\n${legacyId},${legacySession.id},2026-01-01T00:00:00.000Z,1,2,single`,
      }).then(assertResponse)
      expect(TournamentManager.getDetails(legacySession.id)).toMatchObject({
        status: 'started',
        frozen: true,
      })
      expect(
        TournamentSource.findActiveTournament(legacySession.id)?.status
      ).toBe('started')
    }
  )

  test.serial('migrates existing tournament rows as started', () => {
    const directory = fileURLToPath(
      new URL('../../../../drizzle/', import.meta.url)
    )
    const database = new Database(':memory:')
    try {
      for (const file of readdirSync(directory)
        .filter(file => file.endsWith('.sql') && file < '0013')
        .toSorted())
        database.run(readFileSync(`${directory}/${file}`, 'utf8'))
      database.run(
        "INSERT INTO sessions (id, created_at, name, date) VALUES ('legacy-session', 1, 'Legacy', 1)"
      )
      database.run(
        "INSERT INTO tournaments (id, created_at, session) VALUES ('legacy', 1, 'legacy-session')"
      )
      database.run(
        readFileSync(`${directory}/0013_tournament_draft_status.sql`, 'utf8')
      )
      expect(
        database
          .query('SELECT status, frozen_at FROM tournaments WHERE id = ?')
          .get('legacy')
      ).toEqual({ status: 'started', frozen_at: null })
    } finally {
      database.close()
    }
  })
})
