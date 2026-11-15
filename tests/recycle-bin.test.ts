import AdminManager from '@backend/src/managers/admin.manager'
import {
  isRecycleRecordRequest,
  isRecycleRequest,
  recycleTables,
} from '@common/models/recycleBin'
import { describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import assert from 'node:assert/strict'
import * as schema from '../backend/database/schema'
import {
  sessions,
  sessionSignups,
  tracks,
  users,
} from '../backend/database/schema'
import { db } from './setup'
import { assertResponse, createTracks, createUser, login } from './utils'

describe('Admin recycle bin', () => {
  test('lists deleted entities without password hashes and restores them', async () => {
    const admin = await login(createUser('recycle-admin', 'admin'))
    const user = createUser('recycle-deleted-user')
    const [track] = createTracks()
    const deletedAt = new Date('2026-01-02T12:00:00Z')
    db.update(users).set({ deletedAt }).where(eq(users.id, user.id)).run()
    db.update(tracks).set({ deletedAt }).where(eq(tracks.id, track.id)).run()
    const response = await AdminManager.onGetRecycleBin(admin)
    assertResponse(response)
    const item = response.items.find(item => item.id === user.id)
    assert(item?.table === 'users')
    expect(item.deletedAt).toEqual(deletedAt)
    expect(item.record.passwordHash).toBeUndefined()
    expect(JSON.stringify(item)).not.toContain('passwordHash')
    expect(response.items.some(item => item.id === track.id)).toBe(true)
    assertResponse(
      await AdminManager.onMutateRecycleBin(admin, {
        table: 'users',
        id: user.id,
        action: 'restore',
      })
    )
    expect(
      db.select().from(users).where(eq(users.id, user.id)).get()?.deletedAt
    ).toBeNull()
    const after = await AdminManager.onGetRecycleBin(admin)
    assertResponse(after)
    expect(after.items.some(item => item.id === user.id)).toBe(false)
    assertResponse(
      await AdminManager.onMutateRecycleBin(admin, {
        table: 'tracks',
        id: track.id,
        action: 'delete',
      })
    )
    expect(
      db.select().from(tracks).where(eq(tracks.id, track.id)).get()
    ).toBeUndefined()
  })

  test('rejects non-admins, invalid requests, and operations on active or missing records', async () => {
    const socket = await login(createUser('recycle-permissions'))
    await assert.rejects(() => AdminManager.onGetRecycleBin(socket))
    await assert.rejects(() =>
      AdminManager.onMutateRecycleBin(socket, {
        table: 'users',
        id: 'missing',
        action: 'delete',
      })
    )
    const adminUser = createUser('recycle-validation', 'admin')
    const admin = await login(adminUser)
    await assert.rejects(() =>
      AdminManager.onMutateRecycleBin(admin, {
        table: 'users',
        id: adminUser.id,
        action: 'delete',
      })
    )
    await assert.rejects(() =>
      AdminManager.onMutateRecycleBin(admin, {
        table: 'tracks',
        id: 'missing',
        action: 'restore',
      })
    )
    expect(
      isRecycleRequest({ table: '__proto__', id: 'x', action: 'delete' })
    ).toBe(false)
    expect(
      isRecycleRequest({ table: 'users', id: 'x', action: 'invalid' })
    ).toBe(false)
  })

  test('requires parents to be restored and dependents to be removed first', async () => {
    const admin = await login(createUser('recycle-dependencies', 'admin'))
    const user = createUser('recycle-signup')
    const session = db
      .insert(sessions)
      .values({
        name: 'Recycle session',
        date: new Date(),
        deletedAt: new Date(),
      })
      .returning()
      .get()
    const signup = db
      .insert(sessionSignups)
      .values({
        session: session.id,
        user: user.id,
        response: 'yes',
        deletedAt: new Date(),
      })
      .returning()
      .get()
    await assert.rejects(
      () =>
        AdminManager.onMutateRecycleBin(admin, {
          table: 'sessionSignups',
          id: signup.id,
          action: 'restore',
        }),
      /tilknyttede/
    )
    await assert.rejects(
      () =>
        AdminManager.onMutateRecycleBin(admin, {
          table: 'sessions',
          id: session.id,
          action: 'delete',
        }),
      /avhengige/
    )
    expect(
      db.select().from(sessions).where(eq(sessions.id, session.id)).get()
    ).toBeDefined()
    assertResponse(
      await AdminManager.onMutateRecycleBin(admin, {
        table: 'sessions',
        id: session.id,
        action: 'restore',
      })
    )
    assertResponse(
      await AdminManager.onMutateRecycleBin(admin, {
        table: 'sessionSignups',
        id: signup.id,
        action: 'restore',
      })
    )
    expect(
      db
        .select()
        .from(sessionSignups)
        .where(eq(sessionSignups.id, signup.id))
        .get()?.deletedAt
    ).toBeNull()
  })
})

test('recycle bin includes every soft-deletable table without webhook payloads', async () => {
  const admin = await login(createUser('recycle-all-tables', 'admin'))
  const deletedAt = new Date()
  const user = createUser('recycle-all-deleted')
  db.update(users).set({ deletedAt }).where(eq(users.id, user.id)).run()
  const [track] = createTracks()
  db.update(tracks).set({ deletedAt }).where(eq(tracks.id, track.id)).run()
  const session = db
    .insert(sessions)
    .values({ name: 'All deleted records', date: new Date(), deletedAt })
    .returning()
    .get()
  db.insert(sessionSignups)
    .values({ session: session.id, user: user.id, response: 'yes', deletedAt })
    .run()
  db.insert(schema.timeEntries).values({ user: user.id, deletedAt }).run()
  const match = db
    .insert(schema.matches)
    .values({ deletedAt })
    .returning()
    .get()
  const tournament = db
    .insert(schema.tournaments)
    .values({ session: session.id, deletedAt })
    .returning()
    .get()
  db.insert(schema.tournamentStages)
    .values({
      tournament: tournament.id,
      stage: 'group',
      tracks: [track.id],
      deletedAt,
    })
    .run()
  const group = db
    .insert(schema.tournamentGroups)
    .values({ tournament: tournament.id, name: 'Deleted group', deletedAt })
    .returning()
    .get()
  db.insert(schema.tournamentPlayers)
    .values({
      tournament: tournament.id,
      user: user.id,
      groupId: group.id,
      admission: 1,
      rating: 1000,
      deletedAt,
    })
    .returning()
    .get()
  const fixture = db
    .insert(schema.tournamentMatches)
    .values({
      tournament: tournament.id,
      matchId: match.id,
      groupId: group.id,
      bracket: 'group',
      round: 1,
      order: 1,
      deletedAt,
    })
    .returning()
    .get()
  db.insert(schema.tournamentMatchSlots)
    .values({
      tournamentMatch: fixture.id,
      position: 1,
      kind: 'player',
      slotHolderId: user.id,
      deletedAt,
    })
    .run()
  const capture = db
    .insert(schema.webhookCaptures)
    .values({
      gameId: 'recycle-private-game',
      session: session.id,
      totalPlayers: 1,
      sourceGame: 'turbo',
      pluginName: 'test',
      pluginVersion: 'test',
      deletedAt,
    })
    .returning()
    .get()
  db.insert(schema.webhookEvents)
    .values({
      eventId: 'recycle-private-event',
      capture: capture.id,
      sequence: 1,
      type: 'test',
      occurredAt: new Date(),
      rawPayload: 'private-webhook-sentinel',
      deletedAt,
    })
    .run()
  const response = await AdminManager.onGetRecycleBin(admin)
  assertResponse(response)
  expect([...new Set(response.items.map(item => item.table))].sort()).toEqual(
    [...recycleTables].sort()
  )
  expect(JSON.stringify(response)).not.toContain('private-webhook-sentinel')
  db.insert(schema.tournaments).values({ session: session.id }).run()
  db.update(sessions)
    .set({ deletedAt: null })
    .where(eq(sessions.id, session.id))
    .run()
  await assert.rejects(() =>
    AdminManager.onMutateRecycleBin(admin, {
      table: 'tournaments',
      id: tournament.id,
      action: 'restore',
    })
  )
  expect(
    db
      .select()
      .from(schema.tournaments)
      .where(eq(schema.tournaments.id, tournament.id))
      .get()?.deletedAt
  ).toEqual(deletedAt)
})

async function deletedFixture(name: string) {
  const adminUser = createUser(`${name}-admin`, 'admin')
  const admin = await login(adminUser)
  const user = createUser(`${name}-player`)
  const [track] = createTracks()
  const session = db
    .insert(sessions)
    .values({ name, date: new Date() })
    .returning()
    .get()
  const tournament = db
    .insert(schema.tournaments)
    .values({ session: session.id, tieBreakerTrack: track.id })
    .returning()
    .get()
  const group = db
    .insert(schema.tournamentGroups)
    .values({ tournament: tournament.id, name })
    .returning()
    .get()
  for (const [index, player] of [adminUser, user].entries()) {
    db.insert(schema.tournamentPlayers)
      .values({
        id: `${tournament.id}:${player.id}`,
        tournament: tournament.id,
        user: player.id,
        groupId: group.id,
        admission: index + 1,
        rating: 1000,
      })
      .run()
  }
  const stage = db
    .insert(schema.tournamentStages)
    .values({ tournament: tournament.id, stage: 'group', tracks: [track.id] })
    .returning()
    .get()
  const match = db
    .insert(schema.matches)
    .values({
      session: session.id,
      track: track.id,
      user1: adminUser.id,
      user2: user.id,
      stage: 'group',
    })
    .returning()
    .get()
  const deletedAt = new Date()
  const fixture = db
    .insert(schema.tournamentMatches)
    .values({
      tournament: tournament.id,
      matchId: match.id,
      groupId: group.id,
      bracket: 'group',
      round: 1,
      order: 1,
      deletedAt,
    })
    .returning()
    .get()
  const slots = db
    .insert(schema.tournamentMatchSlots)
    .values([
      {
        tournamentMatch: fixture.id,
        position: 1,
        kind: 'player',
        slotHolderId: adminUser.id,
        deletedAt,
      },
      {
        tournamentMatch: fixture.id,
        position: 2,
        kind: 'player',
        slotHolderId: user.id,
        deletedAt,
      },
    ])
    .returning()
    .all()
  return { admin, user, track, stage, group, fixture, slots, deletedAt }
}

test('restores tournament fixtures and their required slots atomically', async () => {
  const { admin, user, fixture, slots, deletedAt } =
    await deletedFixture('recycle-fixture')
  db.update(users).set({ deletedAt }).where(eq(users.id, user.id)).run()
  await assert.rejects(
    () =>
      AdminManager.onMutateRecycleBin(admin, {
        table: 'tournamentMatches',
        id: fixture.id,
        action: 'restore',
      }),
    /tilknyttede/
  )
  expect(
    db
      .select()
      .from(schema.tournamentMatches)
      .where(eq(schema.tournamentMatches.id, fixture.id))
      .get()?.deletedAt
  ).toEqual(deletedAt)
  for (const slot of slots)
    expect(
      db
        .select()
        .from(schema.tournamentMatchSlots)
        .where(eq(schema.tournamentMatchSlots.id, slot.id))
        .get()?.deletedAt
    ).toEqual(deletedAt)
  assertResponse(
    await AdminManager.onMutateRecycleBin(admin, {
      table: 'users',
      id: user.id,
      action: 'restore',
    })
  )
  assertResponse(
    await AdminManager.onMutateRecycleBin(admin, {
      table: 'tournamentMatches',
      id: fixture.id,
      action: 'restore',
    })
  )
  expect(
    db
      .select()
      .from(schema.tournamentMatches)
      .where(eq(schema.tournamentMatches.id, fixture.id))
      .get()?.deletedAt
  ).toBeNull()
  for (const slot of slots)
    expect(
      db
        .select()
        .from(schema.tournamentMatchSlots)
        .where(eq(schema.tournamentMatchSlots.id, slot.id))
        .get()?.deletedAt
    ).toBeNull()
})

test('preserves logical slot and stage dependencies, including deleted records', async () => {
  const { admin, user, track, stage, group, fixture, slots, deletedAt } =
    await deletedFixture('recycle-logical')
  db.update(schema.tournamentStages)
    .set({ deletedAt })
    .where(eq(schema.tournamentStages.id, stage.id))
    .run()
  db.update(tracks).set({ deletedAt }).where(eq(tracks.id, track.id)).run()
  await assert.rejects(
    () =>
      AdminManager.onMutateRecycleBin(admin, {
        table: 'tournamentStages',
        id: stage.id,
        action: 'restore',
      }),
    /tilknyttede/
  )
  db.update(schema.matches)
    .set({ track: null })
    .where(eq(schema.matches.track, track.id))
    .run()
  db.update(schema.tournaments)
    .set({ tieBreakerTrack: null })
    .where(eq(schema.tournaments.tieBreakerTrack, track.id))
    .run()
  await assert.rejects(
    () =>
      AdminManager.onMutateRecycleBin(admin, {
        table: 'tracks',
        id: track.id,
        action: 'delete',
      }),
    /avhengige/
  )
  db.update(schema.matches)
    .set({ user2: null })
    .where(eq(schema.matches.user2, user.id))
    .run()
  db.delete(schema.tournamentPlayers)
    .where(eq(schema.tournamentPlayers.user, user.id))
    .run()
  db.update(users).set({ deletedAt }).where(eq(users.id, user.id)).run()
  await assert.rejects(
    () =>
      AdminManager.onMutateRecycleBin(admin, {
        table: 'users',
        id: user.id,
        action: 'delete',
      }),
    /avhengige/
  )
  db.update(schema.tournamentMatchSlots)
    .set({ kind: 'group_rank', slotHolderId: group.id, rank: 1 })
    .where(eq(schema.tournamentMatchSlots.id, slots[1].id))
    .run()
  db.update(schema.tournamentMatchSlots)
    .set({ kind: 'match_winner', slotHolderId: fixture.id })
    .where(eq(schema.tournamentMatchSlots.id, slots[0].id))
    .run()
  db.delete(schema.tournamentPlayers)
    .where(eq(schema.tournamentPlayers.groupId, group.id))
    .run()
  db.update(schema.tournamentMatches)
    .set({ groupId: null })
    .where(eq(schema.tournamentMatches.id, fixture.id))
    .run()
  db.update(schema.tournamentGroups)
    .set({ deletedAt })
    .where(eq(schema.tournamentGroups.id, group.id))
    .run()
  await assert.rejects(
    () =>
      AdminManager.onMutateRecycleBin(admin, {
        table: 'tournamentGroups',
        id: group.id,
        action: 'delete',
      }),
    /avhengige/
  )
  await assert.rejects(
    () =>
      AdminManager.onMutateRecycleBin(admin, {
        table: 'tournamentMatches',
        id: fixture.id,
        action: 'restore',
      }),
    /tilknyttede/
  )
  expect(
    db
      .select()
      .from(schema.tournamentMatchSlots)
      .where(eq(schema.tournamentMatchSlots.id, slots[0].id))
      .get()?.deletedAt
  ).toEqual(deletedAt)
})

test('record details expose complete deleted records only to admins and never include password hashes', async () => {
  const adminUser = createUser('recycle-detail-admin', 'admin')
  const admin = await login(adminUser)
  const regular = await login(createUser('recycle-detail-regular'))
  const deleted = createUser('recycle-detail-deleted')
  const deletedAt = new Date()
  db.update(users).set({ deletedAt }).where(eq(users.id, deleted.id)).run()
  const response = await AdminManager.onGetRecycleRecord(admin, {
    table: 'users',
    id: deleted.id,
  })
  assertResponse(response)
  expect(response.record.email).toBe(deleted.email)
  expect(response.record.deletedAt).toEqual(deletedAt)
  expect(Object.hasOwn(response.record, 'passwordHash')).toBe(false)
  const session = db
    .insert(sessions)
    .values({
      name: 'Detail session',
      date: new Date(),
      description: 'Full record description',
      deletedAt,
    })
    .returning()
    .get()
  const details = await AdminManager.onGetRecycleRecord(admin, {
    table: 'sessions',
    id: session.id,
  })
  assertResponse(details)
  expect(details.record.description).toBe('Full record description')
  const signup = db
    .insert(sessionSignups)
    .values({
      session: session.id,
      user: deleted.id,
      response: 'maybe',
      deletedAt,
    })
    .returning()
    .get()
  const signupDetails = await AdminManager.onGetRecycleRecord(admin, {
    table: 'sessionSignups',
    id: signup.id,
  })
  assertResponse(signupDetails)
  expect(signupDetails.record.response).toBe('maybe')
  expect(signupDetails.record.session).toBe(session.id)
  await assert.rejects(() =>
    AdminManager.onGetRecycleRecord(regular, { table: 'users', id: deleted.id })
  )
  await assert.rejects(() =>
    AdminManager.onGetRecycleRecord(admin, { table: 'users', id: adminUser.id })
  )
  await assert.rejects(() =>
    AdminManager.onGetRecycleRecord(admin, { table: 'sessions', id: 'missing' })
  )
  const invalid: unknown = { table: '__proto__', id: 'invalid' }
  expect(isRecycleRecordRequest(invalid)).toBe(false)
})
