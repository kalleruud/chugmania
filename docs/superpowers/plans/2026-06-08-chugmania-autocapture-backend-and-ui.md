# Chugmania Auto-Capture — Backend + UI Implementation Plan (PR side)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-side ingest + a "Ubekrefta runder" assignment UI to Chugmania so finish times POSTed by the Openplanet plugin become confirmed time entries (and 1v1 matches) on the active session, running in parallel with manual entry.

**Architecture:** A new HTTP endpoint `POST /api/capture/heat` (token-auth) writes unconfirmed laps to a new `unconfirmed_laps` table while a session is marked "active for capture". The frontend renders those as faded, nameless rows at the top of the active session; an admin clicks one and assigns player(s) via dropdowns (solo = 1, 1v1 = 2 + swap), which writes `time_entries` (+ a completed `matches` row for 1v1) through the existing reactive Socket.IO path. Capture logic is split into server-free modules (`capture.logic.ts`, `capture.store.ts`) so it is unit-testable without booting the server.

**Tech Stack:** TypeScript (strict), Express 5, Socket.IO, Drizzle ORM + better-sqlite3, React 19 + Vite, Tailwind, Radix dialog, `node:test` + `node:assert` run via `tsx`.

**Companion plan:** the Openplanet plugin lives in its own repo — see `2026-06-08-trackmania-openplanet-capture-plugin.md`. The seam between them is the contract documented in Task 9.

**Conventions (from AGENTS.md):** 2-space indent, single quotes, **no semicolons**, trailing commas, explicit types at boundaries, no `any`, `loc.no.*` for all user strings, every mutation `broadcast`s via its `getAll*` fetch helper. Run `npm run check` before every commit.

---

## File structure

**Backend / common (create):**
- `common/models/capture.ts` — heat payload + contract version, `UnconfirmedLap`/`UnconfirmedRound` DTOs, confirm/discard/active-session request types + guards, `CaptureState`.
- `backend/src/managers/capture.logic.ts` — pure, server-free functions (payload guard, winner, template, assignment validation).
- `backend/src/managers/capture.logic.spec.ts` — unit tests.
- `backend/src/managers/capture.store.ts` — pure DB ops taking `db` as a param (ingest, fetch, confirm, discard).
- `backend/src/managers/capture.store.spec.ts` — integration tests against an in-memory DB.
- `backend/src/managers/capture.manager.ts` — HTTP/socket handlers + in-memory active-session state.
- `docs/autocapture/capture-contract.md` — the cross-repo HTTP contract.
- `scripts/mock-plugin.ts` — dev script that POSTs a fake heat for manual E2E.

**Backend / common (modify):**
- `backend/database/schema.ts` — TM2020 track columns + relax nullables, `time_entries.source`, `unconfirmed_laps` table.
- `backend/src/server.ts` — `express.json` + the capture route, `CAPTURE_TOKEN`, socket wiring, connect-time emits.
- `common/models/socket.io.ts` — new events.
- `common/models/importCsv.ts` — add `'unconfirmedLaps'` to the table union.
- `backend/src/managers/admin.manager.ts` — `TABLE_MAP` + `EXCLUDED_COL_EXPORT`.
- `.env.example` — add `CAPTURE_TOKEN`, fix stale `PRIVATE_KEY`.
- `package.json` — add `test` script.

**Frontend (create):**
- `frontend/components/capture/UnconfirmedRoundsTable.tsx`
- `frontend/components/capture/ConfirmRoundDialog.tsx`
- `frontend/components/capture/ActiveSessionControl.tsx`

**Frontend (modify):**
- `frontend/contexts/DataContext.tsx` — store `all_unconfirmed_rounds` + `capture_state`.
- `frontend/app/pages/SessionPage.tsx` — render the control + faded table on the active session.
- `frontend/lib/locales.ts` — capture strings + `admin.tables` entry.

---

## Task 0: Test tooling

**Files:**
- Modify: `package.json` (scripts)

- [ ] **Step 1: Add a test script**

In `package.json` `scripts`, add after `"check"`:

```json
"test": "tsx --test \"backend/**/*.spec.ts\"",
```

- [ ] **Step 2: Verify the runner works with a throwaway spec**

Create `backend/src/managers/_smoke.spec.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('runner works', () => {
  assert.equal(1 + 1, 2)
})
```

Run: `npx tsx --test backend/src/managers/_smoke.spec.ts`
Expected: `# pass 1`.

- [ ] **Step 3: Delete the smoke spec and commit**

```bash
rm backend/src/managers/_smoke.spec.ts
git add package.json
git commit -m "chore: add tsx-based node:test script"
```

---

## Task 1: Schema changes + migration

**Files:**
- Modify: `backend/database/schema.ts`

- [ ] **Step 1: Relax Turbo track columns and add TM2020 map columns**

In `backend/database/schema.ts`, replace the `tracks` table (lines 52-57) with:

```ts
export const tracks = sqliteTable('tracks', {
  ...metadata,
  number: integer(),
  level: text().$type<TrackLevel>(),
  type: text().$type<TrackType>(),
  mapUid: text('map_uid').unique(),
  name: text(),
  author: text(),
})
```

- [ ] **Step 2: Add `source` to time entries**

In the `timeEntries` table, add after the `comment` column:

```ts
  source: text()
    .$type<'manual' | 'auto'>()
    .notNull()
    .$default(() => 'manual'),
```

- [ ] **Step 3: Add the `unconfirmed_laps` table**

Append at the end of `backend/database/schema.ts`:

```ts
export const unconfirmedLaps = sqliteTable('unconfirmed_laps', {
  ...metadata,
  session: text()
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  track: text()
    .notNull()
    .references(() => tracks.id),
  heatId: text('heat_id').notNull(),
  slot: integer().notNull(),
  duration: integer('duration_ms').notNull(),
  playerCount: integer('player_count').notNull(),
})
```

- [ ] **Step 4: Generate the migration**

Run: `npm run db:gen`
Expected: a new file under `drizzle/` (e.g. `drizzle/0007_*.sql`) creating `unconfirmed_laps`, altering `tracks`, and adding `time_entries.source`.

- [ ] **Step 5: Typecheck + commit**

Run: `npm run check`
Expected: passes (existing `Track`/`TimeEntry` models pick up the new columns via `$inferSelect`).

```bash
git add backend/database/schema.ts drizzle/
git commit -m "feat(db): add TM2020 map fields, time_entries.source, unconfirmed_laps"
```

---

## Task 2: Capture common models

**Files:**
- Create: `common/models/capture.ts`

- [ ] **Step 1: Write the models, request types, and guards**

Create `common/models/capture.ts`:

```ts
import type { unconfirmedLaps } from '../../backend/database/schema'
import type { Session } from './session'
import type { Track } from './track'
import type { User } from './user'

export const CAPTURE_CONTRACT_VERSION = 1

export type CaptureSlotResult = {
  slot: number
  bestTimeMs: number
}

export type CaptureHeatPayload = {
  contractVersion: number
  heatId: string
  mapUid: string
  mapName: string
  mapAuthor?: string
  playerCount: number
  results: CaptureSlotResult[]
  serverTime?: number
}

export type UnconfirmedLap = typeof unconfirmedLaps.$inferSelect

export type UnconfirmedRound = {
  heatId: string
  session: Session['id']
  track: Track['id']
  playerCount: number
  createdAt: Date
  laps: { slot: number; duration: number }[]
}

export type CaptureState = {
  activeSessionId: Session['id'] | null
}

export type CaptureAssignment = {
  slot: number
  user: User['id']
}

export type ConfirmCaptureRequest = {
  type: 'ConfirmCaptureRequest'
  heatId: string
  assignments: CaptureAssignment[]
}

export function isConfirmCaptureRequest(
  data: any
): data is ConfirmCaptureRequest {
  if (typeof data !== 'object' || data === null) return false
  return (
    data.type === 'ConfirmCaptureRequest' &&
    typeof data.heatId === 'string' &&
    Array.isArray(data.assignments)
  )
}

export type DiscardCaptureRequest = {
  type: 'DiscardCaptureRequest'
  heatId: string
}

export function isDiscardCaptureRequest(
  data: any
): data is DiscardCaptureRequest {
  if (typeof data !== 'object' || data === null) return false
  return data.type === 'DiscardCaptureRequest' && typeof data.heatId === 'string'
}

export type SetActiveSessionRequest = {
  type: 'SetActiveSessionRequest'
  sessionId: Session['id'] | null
}

export function isSetActiveSessionRequest(
  data: any
): data is SetActiveSessionRequest {
  if (typeof data !== 'object' || data === null) return false
  return (
    data.type === 'SetActiveSessionRequest' &&
    (typeof data.sessionId === 'string' || data.sessionId === null)
  )
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run check`
Expected: passes.

```bash
git add common/models/capture.ts
git commit -m "feat(models): add capture DTOs and request guards"
```

---

## Task 3: Pure capture logic (TDD)

**Files:**
- Create: `backend/src/managers/capture.logic.ts`
- Test: `backend/src/managers/capture.logic.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/src/managers/capture.logic.spec.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  isHeatPayload,
  templateFor,
  winningSlot,
  validateAssignments,
} from './capture.logic'

const validPayload = {
  contractVersion: 1,
  heatId: 'h1',
  mapUid: 'map-uid',
  mapName: 'My Map',
  playerCount: 2,
  results: [
    { slot: 1, bestTimeMs: 42300 },
    { slot: 2, bestTimeMs: 45100 },
  ],
}

test('isHeatPayload accepts a valid payload', () => {
  assert.equal(isHeatPayload(validPayload), true)
})

test('isHeatPayload rejects missing results', () => {
  assert.equal(isHeatPayload({ ...validPayload, results: undefined }), false)
})

test('isHeatPayload rejects a non-numeric time', () => {
  assert.equal(
    isHeatPayload({ ...validPayload, results: [{ slot: 1, bestTimeMs: 'x' }] }),
    false
  )
})

test('templateFor maps player counts', () => {
  assert.equal(templateFor(1), 'solo')
  assert.equal(templateFor(2), 'duel')
  assert.equal(templateFor(3), null)
})

test('winningSlot returns the faster slot', () => {
  assert.equal(winningSlot([
    { slot: 1, duration: 45100 },
    { slot: 2, duration: 42300 },
  ]), 2)
})

test('winningSlot returns null on a tie', () => {
  assert.equal(winningSlot([
    { slot: 1, duration: 42300 },
    { slot: 2, duration: 42300 },
  ]), null)
})

test('validateAssignments requires one per slot and distinct users for duels', () => {
  const slots = [1, 2]
  assert.equal(
    validateAssignments(slots, [
      { slot: 1, user: 'a' },
      { slot: 2, user: 'b' },
    ]),
    null
  )
  assert.equal(
    typeof validateAssignments(slots, [{ slot: 1, user: 'a' }]),
    'string'
  )
  assert.equal(
    typeof validateAssignments(slots, [
      { slot: 1, user: 'a' },
      { slot: 2, user: 'a' },
    ]),
    'string'
  )
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx --test backend/src/managers/capture.logic.spec.ts`
Expected: FAIL — `Cannot find module './capture.logic'`.

- [ ] **Step 3: Implement the logic**

Create `backend/src/managers/capture.logic.ts`:

```ts
import type {
  CaptureAssignment,
  CaptureHeatPayload,
} from '@common/models/capture'

export function isHeatPayload(data: any): data is CaptureHeatPayload {
  if (typeof data !== 'object' || data === null) return false
  if (typeof data.heatId !== 'string' || data.heatId.length === 0) return false
  if (typeof data.mapUid !== 'string' || data.mapUid.length === 0) return false
  if (typeof data.mapName !== 'string') return false
  if (typeof data.playerCount !== 'number') return false
  if (!Array.isArray(data.results) || data.results.length === 0) return false
  return data.results.every(
    (r: any) =>
      typeof r === 'object' &&
      r !== null &&
      typeof r.slot === 'number' &&
      typeof r.bestTimeMs === 'number' &&
      r.bestTimeMs > 0
  )
}

export function templateFor(playerCount: number): 'solo' | 'duel' | null {
  if (playerCount === 1) return 'solo'
  if (playerCount === 2) return 'duel'
  return null
}

export function winningSlot(
  laps: { slot: number; duration: number }[]
): number | null {
  if (laps.length < 2) return laps[0]?.slot ?? null
  const sorted = [...laps].sort((a, b) => a.duration - b.duration)
  if (sorted[0].duration === sorted[1].duration) return null
  return sorted[0].slot
}

export function validateAssignments(
  slots: number[],
  assignments: CaptureAssignment[]
): string | null {
  for (const slot of slots) {
    const found = assignments.find(a => a.slot === slot)
    if (!found || typeof found.user !== 'string' || found.user.length === 0) {
      return `Mangler spiller for plass ${slot}`
    }
  }
  const users = assignments.map(a => a.user)
  if (new Set(users).size !== users.length) {
    return 'Samme spiller kan ikke stå på begge plassene'
  }
  return null
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx tsx --test backend/src/managers/capture.logic.spec.ts`
Expected: `# pass 7`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/managers/capture.logic.ts backend/src/managers/capture.logic.spec.ts
git commit -m "feat(capture): pure logic for payload validation, winner, assignments"
```

---

## Task 4: Capture store — ingest + fetch (TDD)

**Files:**
- Create: `backend/src/managers/capture.store.ts`
- Test: `backend/src/managers/capture.store.spec.ts`

The store takes a `db` argument so tests can pass an in-memory database — no server import.

- [ ] **Step 1: Write the failing test**

Create `backend/src/managers/capture.store.spec.ts`:

```ts
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import * as schema from '../../database/schema'
import { sessions } from '../../database/schema'
import { getUnconfirmedRounds, ingestHeat } from './capture.store'

type Db = ReturnType<typeof drizzle<typeof schema>>

let db: Db
let sessionId: string

beforeEach(async () => {
  const sqlite = new Database(':memory:')
  db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: 'drizzle' })
  const [s] = await db
    .insert(sessions)
    .values({ name: 'Test', date: new Date() })
    .returning()
  sessionId = s.id
})

const payload = {
  contractVersion: 1,
  heatId: 'heat-1',
  mapUid: 'uid-1',
  mapName: 'Map One',
  playerCount: 2,
  results: [
    { slot: 1, bestTimeMs: 42300 },
    { slot: 2, bestTimeMs: 45100 },
  ],
}

test('ingestHeat creates a track and two laps, grouped into one round', async () => {
  await ingestHeat(db, payload, sessionId)
  const rounds = await getUnconfirmedRounds(db)
  assert.equal(rounds.length, 1)
  assert.equal(rounds[0].heatId, 'heat-1')
  assert.equal(rounds[0].playerCount, 2)
  assert.equal(rounds[0].laps.length, 2)
  const tracks = await db.select().from(schema.tracks)
  assert.equal(tracks.length, 1)
  assert.equal(tracks[0].mapUid, 'uid-1')
})

test('ingestHeat reuses an existing track for the same mapUid', async () => {
  await ingestHeat(db, payload, sessionId)
  await ingestHeat(db, { ...payload, heatId: 'heat-2' }, sessionId)
  const tracks = await db.select().from(schema.tracks)
  assert.equal(tracks.length, 1)
})

test('ingestHeat is idempotent on a duplicate heatId', async () => {
  await ingestHeat(db, payload, sessionId)
  await ingestHeat(db, payload, sessionId)
  const rounds = await getUnconfirmedRounds(db)
  assert.equal(rounds.length, 1)
  assert.equal(rounds[0].laps.length, 2)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx --test backend/src/managers/capture.store.spec.ts`
Expected: FAIL — `Cannot find module './capture.store'`.

- [ ] **Step 3: Implement ingest + fetch**

Create `backend/src/managers/capture.store.ts`:

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx tsx --test backend/src/managers/capture.store.spec.ts`
Expected: `# pass 3`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/managers/capture.store.ts backend/src/managers/capture.store.spec.ts
git commit -m "feat(capture): store ingest + unconfirmed-round fetch with idempotency"
```

---

## Task 5: Capture store — confirm + discard (TDD)

**Files:**
- Modify: `backend/src/managers/capture.store.ts`
- Modify: `backend/src/managers/capture.store.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add these to the **top import block** of `backend/src/managers/capture.store.spec.ts` (prettier organize-imports requires imports at the top):

```ts
import { matches, timeEntries, users } from '../../database/schema'
import { confirmCapture, discardCapture } from './capture.store'
```

Then append the helper + tests to the end of the spec file:

```ts
async function makeUser(db: Db, name: string): Promise<string> {
  const [u] = await db
    .insert(users)
    .values({
      email: `${name}@x.no`,
      firstName: name,
      passwordHash: Buffer.from('x'),
    })
    .returning()
  return u.id
}

test('confirmCapture writes two auto time entries + a completed match, deletes laps', async () => {
  await ingestHeat(db, payload, sessionId)
  const a = await makeUser(db, 'alice')
  const b = await makeUser(db, 'bob')

  await confirmCapture(db, 'heat-1', [
    { slot: 1, user: a },
    { slot: 2, user: b },
  ])

  const entries = await db.select().from(timeEntries)
  assert.equal(entries.length, 2)
  assert.equal(entries.every(e => e.source === 'auto'), true)
  assert.equal(entries.every(e => e.session === sessionId), true)

  const [match] = await db.select().from(matches)
  assert.equal(match.status, 'completed')
  assert.equal(match.winner, a) // slot 1 was faster (42300 < 45100)

  const rounds = await getUnconfirmedRounds(db)
  assert.equal(rounds.length, 0)
})

test('confirmCapture for a solo round writes one entry and no match', async () => {
  await ingestHeat(
    db,
    {
      ...payload,
      heatId: 'solo-1',
      playerCount: 1,
      results: [{ slot: 1, bestTimeMs: 40000 }],
    },
    sessionId
  )
  const a = await makeUser(db, 'solo')
  await confirmCapture(db, 'solo-1', [{ slot: 1, user: a }])
  assert.equal((await db.select().from(timeEntries)).length, 1)
  assert.equal((await db.select().from(matches)).length, 0)
})

test('discardCapture removes laps without writing entries', async () => {
  await ingestHeat(db, payload, sessionId)
  await discardCapture(db, 'heat-1')
  assert.equal((await getUnconfirmedRounds(db)).length, 0)
  assert.equal((await db.select().from(timeEntries)).length, 0)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx --test backend/src/managers/capture.store.spec.ts`
Expected: FAIL — `confirmCapture` / `discardCapture` not exported.

- [ ] **Step 3: Implement confirm + discard**

Add these to the **top import block** of `backend/src/managers/capture.store.ts` (merge with the existing imports; do not append at the bottom — organize-imports will reject that):

```ts
import type { CaptureAssignment as Assignment } from '@common/models/capture'
import { matches, timeEntries } from '../../database/schema'
import { validateAssignments, winningSlot } from './capture.logic'
```

Then append these functions to the end of the file (`winningSlot`/`validateAssignments` come from `capture.logic.ts`):

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx tsx --test backend/src/managers/capture.store.spec.ts`
Expected: `# pass 6`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/managers/capture.store.ts backend/src/managers/capture.store.spec.ts
git commit -m "feat(capture): confirm writes entries + match, discard removes laps"
```

---

## Task 6: Socket.IO event types

**Files:**
- Modify: `common/models/socket.io.ts`

- [ ] **Step 1: Import the capture types**

At the top of `common/models/socket.io.ts`, add to the import block:

```ts
import type {
  CaptureState,
  ConfirmCaptureRequest,
  DiscardCaptureRequest,
  SetActiveSessionRequest,
  UnconfirmedRound,
} from './capture'
```

- [ ] **Step 2: Add server→client events**

In `ServerToClientEvents`, add:

```ts
  all_unconfirmed_rounds: (r: UnconfirmedRound[]) => void
  capture_state: (r: CaptureState) => void
```

- [ ] **Step 3: Add client→server events**

In `ClientToServerEvents`, add:

```ts
  set_active_session: (
    r: SetActiveSessionRequest,
    callback: (r: SuccessResponse | ErrorResponse) => void
  ) => void
  confirm_capture: (
    r: ConfirmCaptureRequest,
    callback: (r: SuccessResponse | ErrorResponse) => void
  ) => void
  discard_capture: (
    r: DiscardCaptureRequest,
    callback: (r: SuccessResponse | ErrorResponse) => void
  ) => void
```

- [ ] **Step 4: Typecheck + commit**

Run: `npm run check`
Expected: passes.

```bash
git add common/models/socket.io.ts
git commit -m "feat(socket): capture event types"
```

---

## Task 7: Capture manager (handlers + active-session state)

**Files:**
- Create: `backend/src/managers/capture.manager.ts`

This module imports `db` and `broadcast` (so it is NOT unit-tested; its logic is already covered by Tasks 3–5).

- [ ] **Step 1: Implement the manager**

Create `backend/src/managers/capture.manager.ts`:

```ts
import {
  isConfirmCaptureRequest,
  isDiscardCaptureRequest,
  isSetActiveSessionRequest,
  type CaptureState,
  type UnconfirmedRound,
} from '@common/models/capture'
import type { EventReq, EventRes } from '@common/models/socket.io'
import loc from '../../../frontend/lib/locales'
import db from '../../database/database'
import { broadcast, type TypedSocket } from '../server'
import AuthManager from './auth.manager'
import { isHeatPayload } from './capture.logic'
import {
  confirmCapture,
  discardCapture,
  getUnconfirmedRounds,
  ingestHeat,
} from './capture.store'
import RatingManager from './rating.manager'

export default class CaptureManager {
  private static activeSessionId: string | null = null

  static getCaptureState(): CaptureState {
    return { activeSessionId: CaptureManager.activeSessionId }
  }

  static async getUnconfirmedRounds(): Promise<UnconfirmedRound[]> {
    return getUnconfirmedRounds(db)
  }

  // Called by the HTTP route. Returns true if the heat was stored, false if ignored.
  static async ingestHeat(body: unknown): Promise<boolean> {
    if (!isHeatPayload(body)) {
      throw new Error(loc.no.error.messages.invalid_request('CaptureHeatPayload'))
    }
    if (!CaptureManager.activeSessionId) {
      console.debug(
        new Date().toISOString(),
        'Capture ignored — no active session',
        body.heatId
      )
      return false
    }
    await ingestHeat(db, body, CaptureManager.activeSessionId)
    broadcast('all_unconfirmed_rounds', await getUnconfirmedRounds(db))
    return true
  }

  static async onSetActiveSession(
    socket: TypedSocket,
    request: EventReq<'set_active_session'>
  ): Promise<EventRes<'set_active_session'>> {
    if (!isSetActiveSessionRequest(request)) {
      throw new Error(
        loc.no.error.messages.invalid_request('SetActiveSessionRequest')
      )
    }
    await AuthManager.checkAuth(socket, ['admin', 'moderator'])
    CaptureManager.activeSessionId = request.sessionId
    broadcast('capture_state', CaptureManager.getCaptureState())
    return { success: true }
  }

  static async onConfirmCapture(
    socket: TypedSocket,
    request: EventReq<'confirm_capture'>
  ): Promise<EventRes<'confirm_capture'>> {
    if (!isConfirmCaptureRequest(request)) {
      throw new Error(
        loc.no.error.messages.invalid_request('ConfirmCaptureRequest')
      )
    }
    await AuthManager.checkAuth(socket, ['admin', 'moderator'])
    await confirmCapture(db, request.heatId, request.assignments)

    await RatingManager.recalculate()
    broadcast('all_unconfirmed_rounds', await getUnconfirmedRounds(db))
    broadcast('all_time_entries', await TimeEntryFeed())
    broadcast('all_matches', await MatchFeed())
    broadcast('all_rankings', await RatingManager.onGetRatings())
    return { success: true }
  }

  static async onDiscardCapture(
    socket: TypedSocket,
    request: EventReq<'discard_capture'>
  ): Promise<EventRes<'discard_capture'>> {
    if (!isDiscardCaptureRequest(request)) {
      throw new Error(
        loc.no.error.messages.invalid_request('DiscardCaptureRequest')
      )
    }
    await AuthManager.checkAuth(socket, ['admin', 'moderator'])
    await discardCapture(db, request.heatId)
    broadcast('all_unconfirmed_rounds', await getUnconfirmedRounds(db))
    return { success: true }
  }
}

async function TimeEntryFeed() {
  const { default: TimeEntryManager } = await import('./timeEntry.manager')
  return TimeEntryManager.getAllTimeEntries()
}

async function MatchFeed() {
  const { default: MatchManager } = await import('./match.manager')
  return MatchManager.getAllMatches()
}
```

(The dynamic `import()` helpers avoid a circular import between `capture.manager` and `timeEntry.manager`/`match.manager`, which both import `broadcast` from `server.ts`.)

- [ ] **Step 2: Typecheck + commit**

Run: `npm run check`
Expected: passes.

```bash
git add backend/src/managers/capture.manager.ts
git commit -m "feat(capture): manager handlers + active-session state"
```

---

## Task 8: HTTP route + socket wiring + env

**Files:**
- Modify: `backend/src/server.ts`
- Modify: `.env.example`

- [ ] **Step 1: Add `CAPTURE_TOKEN` + the ingest route**

In `backend/src/server.ts`, add `CaptureManager` to the manager imports:

```ts
import CaptureManager from './managers/capture.manager'
```

After the `const ORIGIN = ...` line, add:

```ts
const CAPTURE_TOKEN = process.env.CAPTURE_TOKEN
```

After the existing `app.get('/api/sessions/calendar.ics', ...)` block, add:

```ts
app.post('/api/capture/heat', express.json(), async (req, res) => {
  if (!CAPTURE_TOKEN) {
    res.status(503).json({ success: false, message: 'Capture disabled' })
    return
  }
  const auth = req.header('authorization')
  if (auth !== `Bearer ${CAPTURE_TOKEN}`) {
    res.status(401).json({ success: false, message: 'Unauthorized' })
    return
  }
  try {
    const stored = await CaptureManager.ingestHeat(req.body)
    res.status(200).json({ success: true, stored })
  } catch (e) {
    res.status(400).json({ success: false, message: (e as Error).message })
  }
})
```

- [ ] **Step 2: Emit capture state on connect**

Inside `Connect(s)`, after the existing `s.emit('all_tournaments', ...)` line, add:

```ts
  s.emit('capture_state', CaptureManager.getCaptureState())
  s.emit('all_unconfirmed_rounds', await CaptureManager.getUnconfirmedRounds())
```

- [ ] **Step 3: Wire the client→server handlers**

After the existing `setup(s, 'get_tournament_preview', ...)` line, add:

```ts
  setup(s, 'set_active_session', CaptureManager.onSetActiveSession)
  setup(s, 'confirm_capture', CaptureManager.onConfirmCapture)
  setup(s, 'discard_capture', CaptureManager.onDiscardCapture)
```

- [ ] **Step 4: Update `.env.example`**

Replace the contents of `.env.example` with:

```
SECRET="<jwt-signing-secret>"
CAPTURE_TOKEN="<shared-secret-for-the-openplanet-plugin>"
```

- [ ] **Step 5: Typecheck + commit**

Run: `npm run check`
Expected: passes.

```bash
git add backend/src/server.ts .env.example
git commit -m "feat(capture): /api/capture/heat route + socket wiring + CAPTURE_TOKEN"
```

---

## Task 9: Cross-repo contract doc

**Files:**
- Create: `docs/autocapture/capture-contract.md`

- [ ] **Step 1: Write the contract**

Create `docs/autocapture/capture-contract.md`:

```markdown
# Capture HTTP contract (v1)

The Openplanet plugin (separate repo) POSTs finished-heat results to Chugmania.

## Endpoint
`POST /api/capture/heat`

## Auth
Header `Authorization: Bearer <CAPTURE_TOKEN>` — must equal the backend's `CAPTURE_TOKEN` env var.
If the backend has no `CAPTURE_TOKEN` set, the endpoint returns `503` (feature disabled).

## Body (application/json)
\`\`\`json
{
  "contractVersion": 1,
  "heatId": "string — stable across retries; idempotency key",
  "mapUid": "string — TM2020 MapUid",
  "mapName": "string",
  "mapAuthor": "string (optional)",
  "playerCount": 1,
  "results": [{ "slot": 1, "bestTimeMs": 42300 }],
  "serverTime": 0
}
\`\`\`

- `playerCount` 1 → solo, 2 → 1v1. Other values are logged and discarded.
- `results` carries one entry per slot with that slot's best finish time for the map visit.

## Responses
- `200 { success: true, stored: boolean }` — `stored:false` means there was no active session, so the heat was ignored (do NOT retry).
- `401` — bad/missing token.
- `400` — malformed payload.
- `503` — capture disabled (no token configured).

## Idempotency
Re-POSTing the same `heatId` is a no-op. Retry freely on network failure.

## Versioning
Bump `contractVersion` on any breaking change; the backend logic for v1 lives in `backend/src/managers/capture.logic.ts`.
```

- [ ] **Step 2: Commit**

```bash
git add docs/autocapture/capture-contract.md
git commit -m "docs: capture HTTP contract v1"
```

---

## Task 10: CSV completeness (AdminManager)

**Files:**
- Modify: `common/models/importCsv.ts`
- Modify: `backend/src/managers/admin.manager.ts`
- Modify: `frontend/lib/locales.ts`

- [ ] **Step 1: Add the table to the CSV union**

In `common/models/importCsv.ts`, add `'unconfirmedLaps'` to the `ExportCsvRequest['table']` union (the string-literal union of table names).

- [ ] **Step 2: Register the table in AdminManager**

In `backend/src/managers/admin.manager.ts`, import `unconfirmedLaps` from the schema, then add to both objects:

In `EXCLUDED_COL_EXPORT`: `unconfirmedLaps: new Set(),`
In `TABLE_MAP`: `unconfirmedLaps: unconfirmedLaps,`

- [ ] **Step 3: Add the locale label**

In `frontend/lib/locales.ts`, in `no.admin.tables`, add: `unconfirmedLaps: 'Ubekrefta runder',`

- [ ] **Step 4: Typecheck + commit**

Run: `npm run check`
Expected: passes (the `satisfies Record<ExportCsvRequest['table'], ...>` constraints now resolve).

```bash
git add common/models/importCsv.ts backend/src/managers/admin.manager.ts frontend/lib/locales.ts
git commit -m "feat(admin): include unconfirmed_laps in CSV import/export"
```

---

## Task 11: Frontend data wiring

**Files:**
- Modify: `frontend/contexts/DataContext.tsx`

- [ ] **Step 1: Add state, listeners, and context values**

In `frontend/contexts/DataContext.tsx`:

1. Import the types: `import type { CaptureState, UnconfirmedRound } from '@common/models/capture'`.
2. Add state near the other `useState` calls:

```ts
const [unconfirmedRounds, setUnconfirmedRounds] = useState<UnconfirmedRound[]>([])
const [captureState, setCaptureState] = useState<CaptureState>({ activeSessionId: null })
```

3. In the `useEffect` that registers `socket.on(...)`, add:

```ts
socket.on('all_unconfirmed_rounds', data => { setUnconfirmedRounds(data) })
socket.on('capture_state', data => { setCaptureState(data) })
```

and in its cleanup `return () => { ... }`:

```ts
socket.off('all_unconfirmed_rounds')
socket.off('capture_state')
```

4. Add `unconfirmedRounds` and `captureState` to both the context value object and the `useData()` return type (the non-loading branch of the discriminated union).

- [ ] **Step 2: Typecheck + commit**

Run: `npm run check`
Expected: passes.

```bash
git add frontend/contexts/DataContext.tsx
git commit -m "feat(capture): frontend store for unconfirmed rounds + capture state"
```

---

## Task 12: Locale strings for the capture UI

**Files:**
- Modify: `frontend/lib/locales.ts`

- [ ] **Step 1: Add a `capture` block**

In `frontend/lib/locales.ts`, add to the `no` object (sibling of `timeEntry`):

```ts
  capture: {
    unconfirmedTitle: 'Ubekrefta runder',
    activate: 'Aktiver registrering',
    deactivate: 'Stopp registrering',
    active: 'Registrering aktiv',
    assignTitle: 'Hvem kjørte?',
    selectPlayer: 'Velg spiller',
    swap: 'Bytt om',
    confirm: 'Bekreft',
    discard: 'Forkast',
    confirmRequest: {
      loading: 'Bekrefter runde...',
      success: 'Runde registrert',
      error: (err: Error) => `Feil ved registrering: ${err.message}`,
    },
    discardRequest: {
      loading: 'Forkaster runde...',
      success: 'Runde forkastet',
      error: (err: Error) => `Feil ved forkasting: ${err.message}`,
    },
    activateRequest: {
      loading: 'Endrer registrering...',
      success: 'Registrering oppdatert',
      error: (err: Error) => `Feil: ${err.message}`,
    },
  },
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run check`
Expected: passes.

```bash
git add frontend/lib/locales.ts
git commit -m "feat(capture): locale strings"
```

---

## Task 13: ConfirmRoundDialog component

**Files:**
- Create: `frontend/components/capture/ConfirmRoundDialog.tsx`

- [ ] **Step 1: Implement the dialog**

Create `frontend/components/capture/ConfirmRoundDialog.tsx`:

```tsx
import type {
  CaptureAssignment,
  UnconfirmedRound,
} from '@common/models/capture'
import { formatDuration } from '@common/utils/time'
import { useState } from 'react'
import { useConnection } from '../../contexts/ConnectionContext'
import { useData } from '../../contexts/DataContext'
import { toast } from 'sonner'
import loc from '../../lib/locales'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { NativeSelect } from '../ui/native-select'
import { Button } from '../ui/button'

type Props = {
  round: UnconfirmedRound | null
  onClose: () => void
}

export function ConfirmRoundDialog({ round, onClose }: Props) {
  const { socket } = useConnection()
  const { users, tracks } = useData()
  const [picks, setPicks] = useState<Record<number, string>>({})

  if (!round) return null

  const track = tracks.find(t => t.id === round.track)
  const sortedLaps = [...round.laps].sort((a, b) => a.slot - b.slot)

  function setPick(slot: number, user: string) {
    setPicks(prev => ({ ...prev, [slot]: user }))
  }

  function swap() {
    if (sortedLaps.length !== 2) return
    const [s1, s2] = sortedLaps
    setPicks(prev => ({ ...prev, [s1.slot]: prev[s2.slot] ?? '', [s2.slot]: prev[s1.slot] ?? '' }))
  }

  function confirm() {
    const assignments: CaptureAssignment[] = sortedLaps.map(l => ({
      slot: l.slot,
      user: picks[l.slot],
    }))
    toast.promise(
      socket
        .emitWithAck('confirm_capture', {
          type: 'ConfirmCaptureRequest',
          heatId: round!.heatId,
          assignments,
        })
        .then(r => {
          if (!r.success) throw new Error(r.message)
        }),
      loc.no.capture.confirmRequest
    )
    onClose()
  }

  function discard() {
    toast.promise(
      socket
        .emitWithAck('discard_capture', {
          type: 'DiscardCaptureRequest',
          heatId: round!.heatId,
        })
        .then(r => {
          if (!r.success) throw new Error(r.message)
        }),
      loc.no.capture.discardRequest
    )
    onClose()
  }

  return (
    <Dialog open={!!round} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{loc.no.capture.assignTitle}</DialogTitle>
        </DialogHeader>
        <p className='text-muted-foreground text-sm'>{track?.name ?? track?.mapUid}</p>
        <div className='flex flex-col gap-3'>
          {sortedLaps.map(lap => (
            <div key={lap.slot} className='flex items-center justify-between gap-3'>
              <span className='font-mono tabular-nums'>{formatDuration(lap.duration)}</span>
              <NativeSelect
                value={picks[lap.slot] ?? ''}
                onChange={e => setPick(lap.slot, e.target.value)}
              >
                <option value='' disabled>
                  {loc.no.capture.selectPlayer}
                </option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName ?? ''}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ))}
        </div>
        <DialogFooter className='flex-row justify-between'>
          <Button variant='ghost' onClick={discard}>
            {loc.no.capture.discard}
          </Button>
          <div className='flex gap-2'>
            {sortedLaps.length === 2 && (
              <Button variant='outline' onClick={swap}>
                {loc.no.capture.swap}
              </Button>
            )}
            <Button onClick={confirm}>{loc.no.capture.confirm}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

> **Verify during implementation:** confirm the import aliases (`@frontend/*`, `@common/*`) and the `formatDuration` export name in `common/utils/time.ts` match the repo; adjust the imports to the actual paths used by neighbouring components (e.g. `TimeEntryRow.tsx`). The dialog/select/button component paths are confirmed in the grounding notes.

- [ ] **Step 2: Typecheck + commit**

Run: `npm run check`
Expected: passes.

```bash
git add frontend/components/capture/ConfirmRoundDialog.tsx
git commit -m "feat(capture): confirm-round dialog (solo + 1v1 with swap)"
```

---

## Task 14: UnconfirmedRoundsTable + ActiveSessionControl

**Files:**
- Create: `frontend/components/capture/UnconfirmedRoundsTable.tsx`
- Create: `frontend/components/capture/ActiveSessionControl.tsx`

- [ ] **Step 1: Faded table**

Create `frontend/components/capture/UnconfirmedRoundsTable.tsx`:

```tsx
import type { UnconfirmedRound } from '@common/models/capture'
import { formatDuration } from '@common/utils/time'
import { useState } from 'react'
import { useData } from '../../contexts/DataContext'
import loc from '../../lib/locales'
import { ConfirmRoundDialog } from './ConfirmRoundDialog'

export function UnconfirmedRoundsTable({ sessionId }: { sessionId: string }) {
  const { unconfirmedRounds, tracks } = useData()
  const [selected, setSelected] = useState<UnconfirmedRound | null>(null)

  const rounds = unconfirmedRounds.filter(r => r.session === sessionId)
  if (rounds.length === 0) return null

  return (
    <div className='flex flex-col gap-2'>
      <h3 className='text-muted-foreground text-sm font-semibold uppercase'>
        {loc.no.capture.unconfirmedTitle}
      </h3>
      <div className='bg-background-secondary flex flex-col rounded-sm opacity-60'>
        {rounds.flatMap(round =>
          [...round.laps]
            .sort((a, b) => a.slot - b.slot)
            .map(lap => {
              const track = tracks.find(t => t.id === round.track)
              return (
                <button
                  key={`${round.heatId}-${lap.slot}`}
                  onClick={() => setSelected(round)}
                  className='flex items-center justify-between px-4 py-3 text-left hover:opacity-100'
                >
                  <span className='text-muted-foreground'>
                    {track?.name ?? track?.mapUid}
                  </span>
                  <span className='font-mono tabular-nums'>
                    {formatDuration(lap.duration)}
                  </span>
                </button>
              )
            })
        )}
      </div>
      <ConfirmRoundDialog round={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
```

- [ ] **Step 2: Active-session control**

Create `frontend/components/capture/ActiveSessionControl.tsx`:

```tsx
import { toast } from 'sonner'
import { useConnection } from '../../contexts/ConnectionContext'
import { useData } from '../../contexts/DataContext'
import loc from '../../lib/locales'
import { Button } from '../ui/button'

export function ActiveSessionControl({ sessionId }: { sessionId: string }) {
  const { socket } = useConnection()
  const { captureState } = useData()
  const isActive = captureState.activeSessionId === sessionId

  function setActive(active: boolean) {
    toast.promise(
      socket
        .emitWithAck('set_active_session', {
          type: 'SetActiveSessionRequest',
          sessionId: active ? sessionId : null,
        })
        .then(r => {
          if (!r.success) throw new Error(r.message)
        }),
      loc.no.capture.activateRequest
    )
  }

  return (
    <Button
      variant={isActive ? 'default' : 'outline'}
      onClick={() => setActive(!isActive)}
    >
      {isActive ? loc.no.capture.deactivate : loc.no.capture.activate}
    </Button>
  )
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `npm run check`
Expected: passes.

```bash
git add frontend/components/capture/UnconfirmedRoundsTable.tsx frontend/components/capture/ActiveSessionControl.tsx
git commit -m "feat(capture): faded unconfirmed-rounds table + active-session control"
```

---

## Task 15: Wire the capture UI into the session page

**Files:**
- Modify: `frontend/app/pages/SessionPage.tsx`

- [ ] **Step 1: Render the control + table for admins/mods**

In `frontend/app/pages/SessionPage.tsx`:

1. Add imports:

```ts
import { ActiveSessionControl } from '../../components/capture/ActiveSessionControl'
import { UnconfirmedRoundsTable } from '../../components/capture/UnconfirmedRoundsTable'
```

2. Determine moderator status from the existing logged-in user (mirror how the page already reads `loggedInUser`/`isLoggedIn`): `const isModerator = isLoggedIn && loggedInUser.role !== 'user'`.

3. Just above the `{tracks.map(track => (<TrackLeaderboard .../>))}` block, add:

```tsx
{isModerator && (
  <div className='flex flex-col gap-4'>
    <ActiveSessionControl sessionId={session.id} />
    <UnconfirmedRoundsTable sessionId={session.id} />
  </div>
)}
```

- [ ] **Step 2: Build + typecheck**

Run: `npm run check`
Expected: passes.

- [ ] **Step 3: Manual smoke in the running app**

Run: `npm run dev`, log in as an admin, open a session, click **Aktiver registrering**. Confirm the button toggles to **Stopp registrering** (proves `set_active_session` + `capture_state` round-trips).

- [ ] **Step 4: Commit**

```bash
git add frontend/app/pages/SessionPage.tsx
git commit -m "feat(capture): show active-session control + unconfirmed rounds on session page"
```

---

## Task 16: Mock-plugin script + full manual E2E

**Files:**
- Create: `scripts/mock-plugin.ts`

- [ ] **Step 1: Write the mock plugin**

Create `scripts/mock-plugin.ts`:

```ts
const url = process.env.CAPTURE_URL ?? 'http://localhost:6996/api/capture/heat'
const token = process.env.CAPTURE_TOKEN ?? ''
const playerCount = Number(process.argv[2] ?? '2')

const results =
  playerCount === 1
    ? [{ slot: 1, bestTimeMs: 41000 }]
    : [
        { slot: 1, bestTimeMs: 42300 },
        { slot: 2, bestTimeMs: 45100 },
      ]

const body = {
  contractVersion: 1,
  heatId: `mock-${Date.now()}`,
  mapUid: 'mock-map-uid',
  mapName: 'Mock Map',
  playerCount,
  results,
}

const res = await fetch(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify(body),
})
console.log(res.status, await res.json())
```

- [ ] **Step 2: Run the full manual E2E (T4)**

With `npm run dev` running and `CAPTURE_TOKEN` set in `.env`:

1. Log in as admin, open a session, click **Aktiver registrering**.
2. 1v1: `CAPTURE_TOKEN=<token> npx tsx scripts/mock-plugin.ts 2` → a faded row pair appears under **Ubekrefta runder** → click it → assign two players → **Bekreft** → two entries on the leaderboard + a completed match; faded rows vanish.
3. Solo: `... scripts/mock-plugin.ts 1` → one faded row → assign one player → confirms to one leaderboard entry, no match.
4. Click **Stopp registrering**, POST again → response `{ stored: false }`, no faded row (ignored-when-inactive).
5. Confirm manual time entry via "Registrer tid" still works unchanged (parallel-operation check).

- [ ] **Step 3: Commit**

```bash
git add scripts/mock-plugin.ts
git commit -m "chore(capture): mock-plugin script for manual E2E"
```

---

## Task 17: README + finalize PR

- [ ] **Step 1: Document the feature**

Add a short "Auto-capture (Trackmania 2020)" section to `README.md`: what it does, the `CAPTURE_TOKEN` env var, the active-session toggle, and a link to `docs/autocapture/capture-contract.md` and the plugin repo.

- [ ] **Step 2: Full gate**

Run: `npm run check && npm test`
Expected: check passes; `# pass 16` across the spec files.

- [ ] **Step 3: Commit + open PR**

```bash
git add README.md
git commit -m "docs: document Trackmania auto-capture"
git push -u origin feat/trackmania-autocapture
gh pr create --fill
```

(Per the spec: this is a PR to the upstream Chugmania repo; keep it scoped to the capture feature.)

---

## Self-review notes (for the implementer)

- **Run order matters:** Tasks 1→2→3→6 define types others depend on; do not reorder past those.
- **Reactive contract:** every mutation broadcasts via a `getAll*` fetch helper (already done in the manager). If you add a feed, add the matching `socket.on/off` in `DataContext`.
- **`amount_l`:** time entries keep the schema default (`0.5`) — auto-capture never sets the drink amount (it is baked into the lap time per the spec).
- **Role-awareness:** unconfirmed rounds are broadcast to all clients but the UI only renders them for admins/mods, and all mutations are server-side auth-gated. If stricter per-socket filtering is required, that is a follow-up.
