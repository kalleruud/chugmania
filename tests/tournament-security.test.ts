import { isPublishedTimeEntry } from '@common/models/timeEntry'
import type {
  PreviewVisibility,
  TournamentDetails,
} from '@common/models/tournament'
import { getTournamentStages } from '@common/utils/tournament'
import { describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import assert from 'node:assert/strict'
import {
  matches,
  timeEntries,
  tournamentMatches,
  tournaments,
  users,
} from '../backend/database/schema'
import MatchManager from '../backend/src/managers/match.manager'
import SessionManager from '../backend/src/managers/session.manager'
import TimeEntryManager from '../backend/src/managers/timeEntry.manager'
import TournamentManager from '../backend/src/managers/tournament/tournament.manager'
import TournamentSecurity from '../backend/src/managers/tournament/tournament.security'
import UserManager from '../backend/src/managers/user.manager'
import type { TypedSocket } from '../backend/src/server'
import { broadcastTournaments, db, tournamentSockets } from './setup'
import {
  assertResponse,
  createSession,
  createTracks,
  createUser,
  login,
} from './utils'

async function prepare() {
  const owner = createUser(`security-owner-${Bun.randomUUIDv7()}`, 'moderator')
  const admin = createUser(`security-admin-${Bun.randomUUIDv7()}`, 'admin')
  const moderator = createUser(
    `security-mod-${Bun.randomUUIDv7()}`,
    'moderator'
  )
  const player = createUser(`security-player-${Bun.randomUUIDv7()}`)
  const players = [owner, admin, moderator, player]
  const sockets = await Promise.all(players.map(login))
  const emitted = new Map<string, TournamentDetails[]>()
  for (const [index, socket] of sockets.entries()) {
    Object.assign(socket, { id: players[index].id })
    socket.data = { userId: players[index].id, token: '' }
    socket.emit = ((event: string, details: TournamentDetails[]) => {
      if (event === 'all_tournaments') emitted.set(socket.id, details)
      return true
    }) as TypedSocket['emit']
    tournamentSockets.add(socket)
  }
  const session = await createSession(
    sockets[0],
    players.map(user => ({ user: user.id, response: 'yes' }))
  )
  const tracks = createTracks(2)
  const response = await TournamentManager.onCreate(sockets[0], {
    session: session.id,
  })
  assertResponse(response)
  assert(response.details)
  let draft = response.details
  const stageTracks = Object.fromEntries(
    getTournamentStages(draft.config, players.length).map(stage => [
      stage,
      tracks.map(track => track.id),
    ])
  )
  assert(draft.configKey)
  const saved = await TournamentManager.onUpdate(sockets[0], {
    config: { ...draft.config, stageTracks, tieBreakerTrack: tracks[1].id },
    configKey: draft.configKey,
  })
  assertResponse(saved)
  assert(saved.details)
  draft = saved.details

  async function get(socket: TypedSocket) {
    const response = await TournamentManager.onGet(socket, {
      session: session.id,
    })
    assertResponse(response)
    assert(response.details)
    return response.details
  }
  async function visibility(value: PreviewVisibility) {
    const current = await get(sockets[0])
    assert(current.configKey)
    const response = await TournamentManager.onUpdate(sockets[0], {
      config: { ...current.config, previewVisibility: value },
      configKey: current.configKey,
    })
    assertResponse(response)
    assert(response.details)
    return response.details
  }
  function last(socket: TypedSocket) {
    const details = emitted.get(socket.id)?.find(t => t.id === draft.id)
    assert(details)
    return details
  }
  function close() {
    sockets.forEach(socket => tournamentSockets.delete(socket))
  }
  return {
    owner,
    admin,
    moderator,
    player,
    sockets,
    session,
    tracks,
    draft,
    get,
    visibility,
    last,
    close,
  }
}

function assertHidden(
  details: TournamentDetails,
  mode: PreviewVisibility,
  tracks: { id: string }[]
) {
  expect(details.canConfigure).toBe(false)
  expect(details.configKey).toBeNull()
  expect(details.previewKey).toBeNull()
  expect(details.notReadyReason).toBeNull()
  if (mode !== 'visible') {
    expect(details.config.stageTracks).toEqual({})
    expect(details.config.tieBreakerTrack).toBeNull()
    for (const track of tracks)
      expect(JSON.stringify(details)).not.toContain(track.id)
  }
  if (mode === 'hide_tracks') {
    expect(details.matches.length).toBeGreaterThan(0)
    expect(details.matches.every(match => match.track === null)).toBe(true)
  }
  if (mode === 'groups_only' || mode === 'stats_only') {
    expect(details.matches).toEqual([])
    expect(details.tieBreakers).toEqual([])
    expect(details.standings).toEqual([])
  }
  if (mode === 'stats_only') {
    expect(details.groups).toEqual([])
    expect(details.participants).toEqual([])
  } else expect(details.groups).toHaveLength(1)
}

describe('Tournament preview security', () => {
  test.serial(
    'Fetches, initial emissions and live updates enforce all modes without altering the cache',
    async () => {
      const cup = await prepare()
      try {
        expect(cup.draft.config.owner).toBe(cup.owner.id)
        expect(cup.draft.config.previewVisibility).toBe('visible')
        const modes: PreviewVisibility[] = [
          'visible',
          'hide_tracks',
          'groups_only',
          'stats_only',
        ]
        for (const mode of modes) {
          const full = await cup.visibility(mode)
          for (const socket of cup.sockets.slice(0, 2)) {
            const details = await cup.get(socket)
            expect(details.canConfigure).toBe(true)
            expect(details.matches).toEqual(full.matches)
            expect(details.config.stageTracks).toEqual(full.config.stageTracks)
            expect(cup.last(socket)).toEqual(details)
          }
          for (const socket of cup.sockets.slice(2)) {
            const details = await cup.get(socket)
            assertHidden(details, mode, cup.tracks)
            expect(details.workloadSummary).toEqual(full.workloadSummary)
            expect(cup.last(socket)).toEqual(details)
            TournamentSecurity.emit(
              socket,
              TournamentManager.getAllTournaments()
            )
            expect(cup.last(socket)).toEqual(details)
          }
          const cached = TournamentManager.getDetails(cup.session.id)
          expect(cached?.matches).toEqual(full.matches)
          expect(cached?.config).toEqual(full.config)
          expect(
            (await MatchManager.getAllMatches()).some(
              match => match.session === cup.session.id
            )
          ).toBe(false)
          expect(
            (await TimeEntryManager.getAllTimeEntries()).some(
              lap => lap.session === cup.session.id
            )
          ).toBe(false)
        }
        const playerView = await cup.get(cup.sockets[3])
        for (const participant of cup.draft.participants)
          expect(JSON.stringify(playerView)).not.toContain(participant.user)
        for (const group of cup.draft.groups)
          expect(JSON.stringify(playerView)).not.toContain(group.id)
      } finally {
        cup.close()
      }
    }
  )

  test.serial(
    'Only admins and the original creator can mutate drafts, including through stale requests',
    async () => {
      const cup = await prepare()
      try {
        const full = await cup.visibility('hide_tracks')
        assert(full.configKey && full.previewKey)
        for (const socket of cup.sockets.slice(2)) {
          for (const configKey of [full.configKey, 'stale']) {
            await assert.rejects(
              TournamentManager.onUpdate(socket, {
                config: { ...full.config, previewVisibility: 'visible' },
                configKey,
              })
            )
          }
          await assert.rejects(
            TournamentManager.onStart(socket, {
              session: cup.session.id,
              previewKey: full.previewKey,
            })
          )
          await assert.rejects(
            TournamentManager.onDelete(socket, {
              session: cup.session.id,
              deleteRelatedResults: true,
            })
          )
        }
        for (const socket of cup.sockets.slice(0, 2)) {
          await assert.rejects(
            TournamentManager.onUpdate(socket, {
              config: { ...full.config, owner: cup.player.id },
              configKey: full.configKey,
            })
          )
        }
        const adminUpdate = await TournamentManager.onUpdate(cup.sockets[1], {
          config: { ...full.config, previewVisibility: 'stats_only' },
          configKey: full.configKey,
        })
        assertResponse(adminUpdate)
        const conflict = await TournamentManager.onUpdate(cup.sockets[0], {
          config: full.config,
          configKey: full.configKey,
        })
        expect(conflict.success).toBe(false)
        assert('details' in conflict)
        expect(conflict.details?.canConfigure).toBe(true)
        expect(conflict.details?.config.owner).toBe(cup.owner.id)
        await assert.rejects(
          TournamentManager.onUpdate(cup.sockets[0], {
            config: { ...full.config, previewVisibility: 'invalid' },
            configKey: full.configKey,
          } as unknown as Parameters<typeof TournamentManager.onUpdate>[1])
        )
      } finally {
        cup.close()
      }
    }
  )

  test.serial(
    'Live role changes refresh projections, owners retain access after demotion, and deleted users lose access',
    async () => {
      const cup = await prepare()
      const administrator = createUser(
        `security-superadmin-${Bun.randomUUIDv7()}`,
        'admin'
      )
      const socket = await login(administrator)
      try {
        await cup.visibility('stats_only')
        broadcastTournaments.mockClear()
        await UserManager.onEditUser(socket, {
          type: 'EditUserRequest',
          id: cup.admin.id,
          role: 'user',
        }).then(assertResponse)
        expect(broadcastTournaments).toHaveBeenCalled()
        assertHidden(cup.last(cup.sockets[1]), 'stats_only', cup.tracks)
        expect(await cup.get(cup.sockets[1])).toEqual(cup.last(cup.sockets[1]))
        await UserManager.onEditUser(socket, {
          type: 'EditUserRequest',
          id: cup.owner.id,
          role: 'user',
        }).then(assertResponse)
        expect((await cup.get(cup.sockets[0])).canConfigure).toBe(true)
        await cup.visibility('groups_only')
        await UserManager.onEditUser(socket, {
          type: 'EditUserRequest',
          id: cup.moderator.id,
          role: 'admin',
        }).then(assertResponse)
        expect(cup.last(cup.sockets[2]).canConfigure).toBe(true)
        db.update(users)
          .set({ deletedAt: new Date() })
          .where(eq(users.id, cup.owner.id))
          .run()
        TournamentSecurity.emit(
          cup.sockets[0],
          TournamentManager.getAllTournaments()
        )
        await assert.rejects(cup.get(cup.sockets[0]))
        expect(TournamentSecurity.view(cup.draft, cup.owner.id)).toBeNull()
        await UserManager.onEditUser(socket, {
          type: 'EditUserRequest',
          id: cup.owner.id,
          deletedAt: null,
        }).then(assertResponse)
        expect((await cup.get(cup.sockets[0])).canConfigure).toBe(true)
        expect(cup.last(cup.sockets[0]).canConfigure).toBe(true)
      } finally {
        cup.close()
      }
    }
  )

  test.serial(
    'Signups refresh safe stats and starting reveals the persisted tournament to everyone',
    async () => {
      const cup = await prepare()
      try {
        await cup.visibility('stats_only')
        await SessionManager.onRsvpSession(cup.sockets[0], {
          type: 'RsvpSessionRequest',
          session: cup.session.id,
          user: cup.player.id,
          response: 'no',
        }).then(assertResponse)
        expect(cup.last(cup.sockets[3]).workloadSummary.participants).toBe(3)
        assertHidden(cup.last(cup.sockets[3]), 'stats_only', cup.tracks)
        await SessionManager.onRsvpSession(cup.sockets[0], {
          type: 'RsvpSessionRequest',
          session: cup.session.id,
          user: cup.player.id,
          response: 'yes',
        }).then(assertResponse)
        const full = await cup.get(cup.sockets[0])
        assert(full.previewKey)
        const started = await TournamentManager.onStart(cup.sockets[0], {
          session: cup.session.id,
          previewKey: full.previewKey,
        })
        assertResponse(started)
        assert(started.details)
        for (const socket of cup.sockets) {
          const details = await cup.get(socket)
          expect(details.status).toBe('started')
          expect(details.config.previewVisibility).toBe('visible')
          expect(details.config.owner).toBe(cup.owner.id)
          expect(details.matches).toEqual(started.details.matches)
          expect(cup.last(socket)).toEqual(details)
        }
        expect(
          (await MatchManager.getAllMatches()).filter(
            match => match.session === cup.session.id
          )
        ).toHaveLength(started.details.matches.length)
      } finally {
        cup.close()
      }
    }
  )

  test.serial(
    'Draft-linked imported results cannot leak through the shared match or lap feeds',
    async () => {
      const cup = await prepare()
      try {
        await cup.visibility('hide_tracks')
        const match = db
          .insert(matches)
          .values({
            session: cup.session.id,
            track: cup.tracks[0].id,
            user1: cup.owner.id,
            user2: cup.player.id,
          })
          .returning()
          .get()
        db.insert(tournamentMatches)
          .values({
            tournament: cup.draft.id,
            matchId: match.id,
            bracket: 'upper',
            round: 1,
            order: 1,
          })
          .run()
        const lap = db
          .insert(timeEntries)
          .values({
            session: cup.session.id,
            track: cup.tracks[1].id,
            user: cup.player.id,
            tieBreaker: true,
            status: 'planned',
          })
          .returning()
          .get()
        const independent = db
          .insert(timeEntries)
          .values({
            session: cup.session.id,
            track: cup.tracks[1].id,
            user: cup.player.id,
            tieBreaker: false,
            status: 'completed',
            duration: 1000,
          })
          .returning()
          .get()
        expect(
          (await MatchManager.getAllMatches()).some(row => row.id === match.id)
        ).toBe(false)
        const laps = await TimeEntryManager.getAllTimeEntries()
        expect(laps.some(row => row.id === lap.id)).toBe(false)
        expect(laps.some(row => row.id === independent.id)).toBe(true)
      } finally {
        cup.close()
      }
    }
  )

  test.serial(
    'Recreating a draft preserves retained completed and cancelled results in shared feeds',
    async () => {
      const cup = await prepare()
      try {
        const full = await cup.get(cup.sockets[0])
        assert(full.previewKey)
        assertResponse(
          await TournamentManager.onStart(cup.sockets[0], {
            session: cup.session.id,
            previewKey: full.previewKey,
          })
        )
        const retained = db
          .insert(timeEntries)
          .values([
            {
              session: cup.session.id,
              track: cup.tracks[1].id,
              user: cup.owner.id,
              tieBreaker: true,
              status: 'completed',
              duration: 1000,
            },
            {
              session: cup.session.id,
              track: cup.tracks[1].id,
              user: cup.player.id,
              tieBreaker: true,
              status: 'cancelled',
            },
          ])
          .returning()
          .all()
        const match = full.matches.find(match => match.user1 && match.user2)
        assert(match)
        assertResponse(
          await MatchManager.onEditMatch(cup.sockets[0], {
            type: 'EditMatchRequest',
            id: match.id,
            status: 'completed',
            winner: match.user1,
          })
        )
        assertResponse(
          await TournamentManager.onDelete(cup.sockets[0], {
            session: cup.session.id,
            deleteRelatedResults: false,
          })
        )
        assertResponse(
          await TournamentManager.onCreate(cup.sockets[0], {
            session: cup.session.id,
          })
        )
        await cup.visibility('stats_only')
        const laps = await TimeEntryManager.getAllTimeEntries()
        for (const lap of retained.filter(isPublishedTimeEntry))
          expect(laps.find(row => row.id === lap.id)).toEqual(lap)
        expect(
          TimeEntryManager.getAllLatestAfterSession(cup.session.id).map(
            lap => lap.id
          )
        ).toContain(retained[0].id)
        expect(
          (await MatchManager.getAllMatches()).find(row => row.id === match.id)
        ).toMatchObject({ status: 'completed', winner: match.user1 })
        expect((await cup.get(cup.sockets[3])).tieBreakers).toEqual([])
      } finally {
        cup.close()
      }
    }
  )

  test.serial(
    'Public registration cannot grant access to private previews',
    async () => {
      const cup = await prepare()
      const anonymous = {
        id: 'anonymous-client',
        handshake: { auth: {} },
      } as TypedSocket
      const request = {
        type: 'RegisterRequest',
        email: `security-signup-${Bun.randomUUIDv7()}@example.test`,
        password: 'test-password',
        firstName: 'Security signup',
        lastName: '',
        shortName: '',
      }
      try {
        await cup.visibility('stats_only')
        for (const socket of [anonymous, cup.sockets[0], cup.sockets[3]]) {
          await assert.rejects(
            UserManager.onRegister(socket, {
              ...request,
              type: 'RegisterRequest',
              role: 'admin',
            })
          )
          await assert.rejects(
            UserManager.onRegister(socket, {
              ...request,
              type: 'RegisterRequest',
              role: 'moderator',
            })
          )
        }
        await UserManager.onRegister(anonymous, {
          ...request,
          type: 'RegisterRequest',
        }).then(assertResponse)
        const registered = await UserManager.getUser(request.email)
        expect(registered.role).toBe('user')
        assertHidden(
          await cup.get(await login(registered)),
          'stats_only',
          cup.tracks
        )
      } finally {
        cup.close()
      }
    }
  )

  test.serial(
    'Legacy drafts without a known creator grant configuration access only to admins',
    async () => {
      const cup = await prepare()
      try {
        db.update(tournaments)
          .set({ owner: null, previewVisibility: 'hide_tracks' })
          .where(eq(tournaments.id, cup.draft.id))
          .run()
        const viewer = await cup.get(cup.sockets[0])
        assertHidden(viewer, 'hide_tracks', cup.tracks)
        const admin = await cup.get(cup.sockets[1])
        expect(admin.canConfigure).toBe(true)
        expect(admin.config.owner).toBeNull()
        expect(
          db
            .insert(tournaments)
            .values({ session: (await createSession(cup.sockets[1], [])).id })
            .returning()
            .get()
        ).toMatchObject({ owner: null, previewVisibility: 'visible' })
      } finally {
        cup.close()
      }
    }
  )
})
