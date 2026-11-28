import loc from '@common/locale/locales'
import type { Track } from '@common/models/track'
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import assert from 'node:assert/strict'
import { tracks } from '../backend/database/schema'
import TrackManager from '../backend/src/managers/track.manager'
import { broadcast } from '../backend/src/server'
import { db } from './setup'
import { assertResponse, createUser, login } from './utils'

type Routes = Record<string, () => Response>

const fixture = (name: string) => Bun.file(`tests/fixtures/${name}`).text()
const json = (body: unknown) => () => Response.json(body)
const html = (body: string) => () => new Response(body)

const exchangeMap = {
  MapUid: 'rIQJwKkx68wvx8CNoKbsGKpmY0g',
  OnlineMapId: 'b59b8cec-ae03-4173-bbc8-b0caf49a32bc',
  Name: 'CarCoaster',
  Authors: [{ User: { UserId: 133974, Name: 'TMesports' }, Role: '' }],
  Uploader: { Name: 'TMesports' },
  MapType: 'TM_Race',
  Laps: 6,
  Medals: { Author: 534719, Gold: 567000, Silver: 642000, Bronze: 803000 },
}

function serve(routes: Routes) {
  return spyOn(globalThis, 'fetch').mockImplementation(
    mock((input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : String(input)
      const route = Object.entries(routes).find(([prefix]) =>
        url.startsWith(prefix)
      )
      return Promise.resolve(
        route ? route[1]() : new Response(null, { status: 404 })
      )
    }) as unknown as typeof fetch
  )
}

async function importTrack(email: string, url: string) {
  const socket = await login({ email })
  return TrackManager.onImportTrack(socket, {
    type: 'ImportTrackRequest',
    url,
  })
}

function storedTrack(id: string): Track | undefined {
  return db.select().from(tracks).where(eq(tracks.id, id)).get()
}

afterEach(() => mock.restore())

describe('importing tracks from links', () => {
  const moderator = createUser('import-moderator', 'moderator')
  const player = createUser('import-player')

  test.serial('stores every Exchange field and broadcasts it', async () => {
    serve({
      'https://trackmania.exchange/api/maps?id=372390': json({
        More: false,
        Results: [exchangeMap],
      }),
    })

    const response = await importTrack(
      moderator.email,
      'https://trackmania.exchange/mapshow/372390'
    )
    assertResponse(response)

    expect(response.track).toMatchObject({
      game: 'next',
      platform: 'pc',
      level: 'custom',
      environment: 'Stadium',
      uid: exchangeMap.MapUid,
      mapId: exchangeMap.OnlineMapId,
      name: 'CarCoaster',
      author: 'TMesports',
      mapType: 'TrackMania\\TM_Race',
      authorMedalMs: 534719,
      goldMedalMs: 567000,
      silverMedalMs: 642000,
      bronzeMedalMs: 803000,
      isLaps: true,
      totalLaps: 6,
    })
    expect(storedTrack(response.track.id)).toEqual(response.track)
    expect(broadcast).toHaveBeenLastCalledWith(
      'all_tracks',
      expect.arrayContaining([response.track])
    )
  })

  test.serial('rejects a track that is already added', async () => {
    serve({
      'https://trackmania.exchange/api/maps?id=372390': json({
        Results: [exchangeMap],
      }),
    })

    await assert.rejects(
      importTrack(
        moderator.email,
        'https://trackmania.exchange/maps/372390/carcoaster'
      ),
      { message: loc.no.tracks.import.alreadyExists('CarCoaster') }
    )
  })

  test.serial('restores a deleted track with fresh metadata', async () => {
    const [deleted] = db
      .update(tracks)
      .set({ deletedAt: new Date(), name: 'Old name' })
      .where(eq(tracks.uid, exchangeMap.MapUid))
      .returning()
      .all()
    serve({
      'https://trackmania.exchange/api/maps?id=372390': json({
        Results: [exchangeMap],
      }),
    })

    const response = await importTrack(
      moderator.email,
      'https://trackmania.exchange/mapshow/372390'
    )
    assertResponse(response)

    expect(response.track.id).toBe(deleted.id)
    expect(storedTrack(deleted.id)).toMatchObject({
      name: 'CarCoaster',
      deletedAt: null,
    })
  })

  test('looks up trackmania.com links on Exchange by uid', async () => {
    const uid = 'a22v0nplKvkZ7pRNLYekEz4C14m'
    serve({
      [`https://trackmania.exchange/api/maps?uid=${uid}`]: json({
        Results: [{ ...exchangeMap, MapUid: uid, Name: 'Mount Stratos' }],
      }),
    })

    const response = await importTrack(
      moderator.email,
      `https://www.trackmania.com/tracks/${uid}`
    )
    assertResponse(response)

    expect(response.track).toMatchObject({ uid, name: 'Mount Stratos' })
  })

  test('falls back to trackmania.io when Exchange lacks the map', async () => {
    const uid = 'OfficialCampaignUid0000000'
    serve({
      'https://trackmania.exchange/api/maps': json({ Results: [] }),
      [`https://trackmania.io/api/map/${uid}`]: json({
        mapUid: uid,
        mapId: 'c3924ff4-560c-43d2-9528-e649df13480b',
        name: '$o$C00Fall $fff2026 - 01',
        mapType: 'TrackMania\\TM_Race',
        collectionName: 'Stadium',
        authorScore: 23001,
        goldScore: 25000,
        silverScore: 28000,
        bronzeScore: 35000,
        authorplayer: { name: 'Nadeo' },
      }),
    })

    const response = await importTrack(
      moderator.email,
      `https://www.trackmania.com/tracks/${uid}`
    )
    assertResponse(response)

    expect(response.track).toMatchObject({
      game: 'next',
      uid,
      name: 'Fall 2026 - 01',
      author: 'Nadeo',
      authorMedalMs: 23001,
      bronzeMedalMs: 35000,
    })
  })

  test('creates a custom Turbo track from its page', async () => {
    serve({
      'https://players.turbo.trackmania.com/ps4/maps/AUwUSBPJfTIRYMUo6gKeM3Zp9ig':
        html(await fixture('turbo-custom.html')),
    })

    const response = await importTrack(
      moderator.email,
      'https://players.turbo.trackmania.com/ps4/maps/AUwUSBPJfTIRYMUo6gKeM3Zp9ig'
    )
    assertResponse(response)

    expect(response.track).toMatchObject({
      game: 'turbo',
      platform: 'ps4',
      level: 'custom',
      uid: 'AUwUSBPJfTIRYMUo6gKeM3Zp9ig',
      name: '022',
      author: 'Tante-satyre',
      environment: 'Canyon',
      authorMedalMs: 132636,
      goldMedalMs: 141000,
      silverMedalMs: 160000,
      bronzeMedalMs: 199000,
      isLaps: true,
    })
  })

  test('links a Turbo campaign page to the existing campaign track', async () => {
    const custom = db
      .insert(tracks)
      .values({ name: '085', game: 'turbo', level: 'custom' })
      .returning()
      .get()
    const existing = db
      .insert(tracks)
      .values({
        name: '085',
        game: 'turbo',
        level: 'blue',
        environment: 'Canyon',
      })
      .returning()
      .get()
    serve({
      'https://players.turbo.trackmania.com/pc/maps/2HfsNUIdzA2guwQNaB7iSLrfl4n':
        html(await fixture('turbo-campaign.html')),
    })

    const response = await importTrack(
      moderator.email,
      'https://players.turbo.trackmania.com/pc/maps/2HfsNUIdzA2guwQNaB7iSLrfl4n'
    )
    assertResponse(response)

    expect(response.track).toMatchObject({
      id: existing.id,
      level: 'blue',
      uid: '2HfsNUIdzA2guwQNaB7iSLrfl4n',
      author: 'Nadeo',
      authorMedalMs: null,
      goldMedalMs: 177924,
    })
    expect(storedTrack(custom.id)).toEqual(custom)
  })

  test('reports a Turbo link without a map as not found', async () => {
    serve({
      'https://players.turbo.trackmania.com/': () =>
        new Response(null, { status: 302, headers: { Location: '/pc/maps' } }),
    })

    await assert.rejects(
      importTrack(
        moderator.email,
        'https://players.turbo.trackmania.com/pc/maps/missing'
      ),
      { message: loc.no.tracks.import.notFound }
    )
  })

  test('falls back to trackmania.io when Exchange is down', async () => {
    const uid = 'ExchangeDownUid00000000000'
    serve({
      'https://trackmania.exchange/': () => new Response(null, { status: 503 }),
      [`https://trackmania.io/api/map/${uid}`]: json({
        mapUid: uid,
        name: 'Backup',
      }),
    })

    const response = await importTrack(
      moderator.email,
      `https://www.trackmania.com/tracks/${uid}`
    )
    assertResponse(response)

    expect(response.track).toMatchObject({ uid, name: 'Backup' })
  })

  test('rejects links from other sites without fetching', async () => {
    const fetchSpy = serve({})

    for (const url of [
      'https://example.com/tracks/abc',
      'https://trackmania.exchange/usershow/1',
      'not a link',
    ])
      await assert.rejects(importTrack(moderator.email, url), {
        message: loc.no.tracks.import.unsupportedLink,
      })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test('only admins and moderators can import tracks', async () => {
    const fetchSpy = serve({})

    await assert.rejects(
      importTrack(player.email, 'https://trackmania.exchange/mapshow/1')
    )
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
