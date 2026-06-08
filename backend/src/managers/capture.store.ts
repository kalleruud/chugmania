import type {
  CaptureAssignment as Assignment,
  CaptureHeatPayload,
  UnconfirmedRound,
} from '@common/models/capture'
import { and, eq, isNull } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '../../database/schema'
import { matches, timeEntries, tracks, unconfirmedLaps } from '../../database/schema'
import { validateAssignments, winningSlot } from './capture.logic'

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

export async function confirmCapture(
  db: Db,
  heatId: string,
  assignments: Assignment[]
): Promise<void> {
  const laps = await lapsForHeat(db, heatId)
  if (laps.length === 0) throw new Error('Fant ingen ubekrefta runde')

  const slots = laps.map(l => l.slot)
  const problem = validateAssignments(slots, assignments)
  if (problem) throw new Error(problem)

  const sessionId = laps[0].session
  const trackId = laps[0].track

  const entryValues = laps.map(lap => {
    const assignment = assignments.find(a => a.slot === lap.slot)!
    return {
      user: assignment.user,
      track: trackId,
      session: sessionId,
      duration: lap.duration,
      source: 'auto' as const,
    }
  })
  await db.insert(timeEntries).values(entryValues)

  if (laps.length === 2) {
    const winSlot = winningSlot(
      laps.map(l => ({ slot: l.slot, duration: l.duration }))
    )
    const userForSlot = (slot: number) =>
      assignments.find(a => a.slot === slot)!.user
    await db.insert(matches).values({
      user1: userForSlot(laps[0].slot),
      user2: userForSlot(laps[1].slot),
      track: trackId,
      session: sessionId,
      winner: winSlot === null ? null : userForSlot(winSlot),
      status: 'completed',
    })
  }

  await deleteHeat(db, heatId)
}

export async function discardCapture(db: Db, heatId: string): Promise<void> {
  await deleteHeat(db, heatId)
}
