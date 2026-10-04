import loc from '@common/locale/locales'
import { isRenameTournamentGroupRequest } from '@common/models/tournament'
import { beforeAll, describe, expect, test } from 'bun:test'
import assert from 'node:assert/strict'
import { db } from '../../../../tests/setup'
import {
  createSession,
  createTracks,
  createUser,
  login,
} from '../../../../tests/utils'
import { tournamentGroups } from '../../../database/schema'
import TournamentSource from '../../../database/tournament.source'
import { broadcast, type TypedSocket } from '../../server'
import TournamentManager from './tournament.manager'

describe('Rename tournament groups', () => {
  let admin: TypedSocket
  let moderator: TypedSocket
  let player: TypedSocket
  let session: string
  let otherSession: string
  let groupId: string
  let otherGroupId: string

  beforeAll(async () => {
    const users = [
      createUser('GroupAdmin', 'admin'),
      createUser('GroupModerator', 'moderator'),
      createUser('GroupPlayer'),
      createUser('GroupPlayerTwo'),
    ]
    admin = await login(users[0])
    moderator = await login(users[1])
    player = await login(users[2])
    const tracks = createTracks()
    for (let index = 0; index < 2; index++) {
      const created = await createSession(
        admin,
        users.map(user => ({ user: user.id, response: 'yes' }))
      )
      const response = await TournamentManager.onCreate(admin, {
        session: created.id,
        groupsCount: 2,
        advancementCount: 1,
        eliminationType: 'single',
        stageTracks: {
          group: tracks.map(track => track.id),
          final: tracks.map(track => track.id),
        },
      })
      assert(response.success && response.details)
      if (index === 0) {
        session = created.id
        groupId = response.details.groups[0].id
      } else {
        otherSession = created.id
        otherGroupId = response.details.groups[0].id
      }
    }
  })

  test.serial(
    'admins and moderators persist names without changing the tournament',
    async () => {
      for (const [index, socket] of [admin, moderator].entries()) {
        const before = TournamentSource.loadTournament(session)
        assert(before)
        const name = `Renamed group ${index}`
        const response = await TournamentManager.onRenameGroup(socket, {
          session,
          groupId,
          name: `  ${name}  `,
        })
        assert(response.success)
        const after = TournamentSource.loadTournament(session)
        assert(after)
        expect(after.groups.find(group => group.id === groupId)?.name).toBe(
          name
        )
        expect(after).toEqual({
          ...before,
          groups: before.groups.map(group =>
            group.id === groupId ? { ...group, name } : group
          ),
        })
        const fetched = await TournamentManager.onGet(player, { session })
        assert(fetched.success && fetched.details)
        expect(response.details).toEqual(fetched.details)
        expect(broadcast).toHaveBeenLastCalledWith(
          'all_tournaments',
          TournamentManager.getAllTournaments(),
          socket.id
        )
        expect(
          db
            .select()
            .from(tournamentGroups)
            .all()
            .find(group => group.id === groupId)?.name
        ).toBe(name)
      }
    }
  )

  test.serial('regular users cannot rename groups', async () => {
    const before = TournamentSource.loadTournament(session)
    await assert.rejects(
      TournamentManager.onRenameGroup(player, {
        session,
        groupId,
        name: 'Forbidden',
      }),
      { message: loc.no.error.messages.insufficient_permissions }
    )
    expect(TournamentSource.loadTournament(session)).toEqual(before)
  })

  test.serial('unauthenticated clients cannot rename groups', async () => {
    const token: unknown = player.handshake.auth.token
    player.handshake.auth.token = undefined
    try {
      await assert.rejects(
        TournamentManager.onRenameGroup(player, {
          session,
          groupId,
          name: 'Forbidden',
        })
      )
    } finally {
      player.handshake.auth.token = token
    }
  })

  test.serial(
    'invalid names and groups from another tournament are rejected without writes',
    async () => {
      const before = TournamentSource.loadTournament(session)
      const otherBefore = TournamentSource.loadTournament(otherSession)
      for (const name of ['', '   ', 'x'.repeat(101)]) {
        await assert.rejects(
          TournamentManager.onRenameGroup(admin, { session, groupId, name }),
          { message: loc.no.tournament.invalidGroupName }
        )
      }
      for (const invalidGroup of ['missing', otherGroupId]) {
        await assert.rejects(
          TournamentManager.onRenameGroup(admin, {
            session,
            groupId: invalidGroup,
            name: 'Wrong group',
          }),
          { message: loc.no.tournament.invalidGroup }
        )
      }
      expect(TournamentSource.loadTournament(session)).toEqual(before)
      expect(TournamentSource.loadTournament(otherSession)).toEqual(otherBefore)
    }
  )

  test('runtime validation rejects malformed requests and accepts the length boundary', () => {
    for (const request of [
      null,
      {},
      { session: 's', groupId: 1, name: 'Name' },
      { session: 's', groupId: 'g', name: 1 },
    ])
      expect(isRenameTournamentGroupRequest(request)).toBe(false)
    expect(
      isRenameTournamentGroupRequest({
        session: 's',
        groupId: 'g',
        name: ` ${'x'.repeat(100)} `,
      })
    ).toBe(true)
  })
})
