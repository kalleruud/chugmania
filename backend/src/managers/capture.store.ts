import type {
  CaptureHeatPayload,
  UnconfirmedRound,
} from '@common/models/capture'
import { and, eq, isNull } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '../../database/schema'
import { tracks, unconfirmedLaps } from '../../database/schema'

type Db = BetterSQLite3Database<typeof schema>

async function resolveTrackId(
  db: Db,
  payload: CaptureHeatPayload
): Promise<string> {
  const existing = await db.query.tracks.findFirst({
    where: eq(tracks.mapUid, payload.mapUid),
  })
  if (existing) return existing.id
  const [created] = await db
    .insert(tracks)
    .values({
      mapUid: payload.mapUid,
      name: payload.mapName,
      author: payload.mapAuthor ?? null,
    })
    .returning()
  return created.id
}

export async function ingestHeat(
  db: Db,
  payload: CaptureHeatPayload,
  sessionId: string
): Promise<void> {
  const already = await db.query.unconfirmedLaps.findFirst({
    where: eq(unconfirmedLaps.heatId, payload.heatId),
  })
  if (already) return

  const trackId = await resolveTrackId(db, payload)

  await db.insert(unconfirmedLaps).values(
    payload.results.map(r => ({
      session: sessionId,
      track: trackId,
      heatId: payload.heatId,
      slot: r.slot,
      duration: r.bestTimeMs,
      playerCount: payload.playerCount,
    }))
  )
}

export async function getUnconfirmedRounds(
  db: Db
): Promise<UnconfirmedRound[]> {
  const rows = await db
    .select()
    .from(unconfirmedLaps)
    .where(isNull(unconfirmedLaps.deletedAt))

  const byHeat = new Map<string, UnconfirmedRound>()
  for (const row of rows) {
    let round = byHeat.get(row.heatId)
    if (!round) {
      round = {
        heatId: row.heatId,
        session: row.session,
        track: row.track,
        playerCount: row.playerCount,
        createdAt: row.createdAt,
        laps: [],
      }
      byHeat.set(row.heatId, round)
    }
    round.laps.push({ slot: row.slot, duration: row.duration })
  }
  return [...byHeat.values()].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  )
}

export async function lapsForHeat(db: Db, heatId: string) {
  return db
    .select()
    .from(unconfirmedLaps)
    .where(
      and(eq(unconfirmedLaps.heatId, heatId), isNull(unconfirmedLaps.deletedAt))
    )
}

export async function deleteHeat(db: Db, heatId: string): Promise<void> {
  await db.delete(unconfirmedLaps).where(eq(unconfirmedLaps.heatId, heatId))
}
