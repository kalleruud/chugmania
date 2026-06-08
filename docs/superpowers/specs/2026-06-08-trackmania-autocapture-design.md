# Chugmania — Trackmania 2020 Auto-Capture (v1 Design)

**Date:** 2026-06-08
**Status:** Approved design, pending implementation plan
**Supersedes:** `CHUGMANIA_AUTOCAPTURE_PLAN.md` (the original brief assumed a dedicated-server/XML-RPC architecture; this document replaces that architecture wholesale — see §10).

**Delivery:** Two repos. (a) The **Openplanet plugin** is its own, separately-owned repo (different language/runtime/distribution). (b) The **Chugmania backend + frontend** changes land as a **PR to the upstream Chugmania repo** (which the author of this work does not own). The only coupling is the versioned `POST /api/capture/heat` JSON contract (§7), documented in the Chugmania repo. The fixture-based ingest tests (T2) let the Chugmania PR be reviewed and verified without the plugin present.

---

## 1. Goal

Capture finish times from in-person Trackmania 2020 sessions automatically, so a player crossing the
finish line produces a correct time-entry row in Chugmania with no manual time/map typing, visible in the
existing frontend — **running in parallel with, and without disturbing, the existing manual workflow.**

**Definition of done (v1):** during a live session, a finished splitscreen or solo run on the gaming PC
produces, after a one-tap player assignment, a correct `time_entries` row (and a `matches` row for 1v1)
attached to the active session, visible on the existing leaderboard. Manual entry continues to work exactly
as before.

---

## 2. Key facts that shape this design (researched, cited)

- **PS5 cannot capture.** Consoles block mods, can't run or join dedicated servers, and have no XML-RPC.
  The racing rig must be a **PC**. ([doc.trackmania.com](https://doc.trackmania.com/club/activities/room/))
- **TM2020 has local splitscreen + hotseat** (confirmed in-game on the free Starter tier). Splitscreen is a
  *local client session* — **no server, no XML-RPC**. Capture must therefore be **client-side**.
- **Openplanet runs during offline local splitscreen** and a plugin can read each player's finish/checkpoint
  times via `CSmArenaClient.Players` → `CSmScriptPlayer.RaceWaypointTimes`, and POST JSON out via
  `Net::HttpPost`. ([CSmArenaClient](https://next.openplanet.dev/ShootMania/CSmArenaClient),
  [Net API](https://openplanet.dev/docs/api/Net/HttpPost),
  [PlayerState Info plugin](https://openplanet.dev/plugin/playerstate))
- **Splitscreen players are local controller slots** (Player 1 / Player 2) under one login, *not* separate
  accounts. The game never knows which human took which seat — so seat→player binding is a manual step in
  Chugmania.
- **Cost:** ~$20/yr Club Access on the gaming PC for Openplanet Developer mode (to run our own unsigned
  plugin), or get the plugin signed. ([Openplanet signature modes](https://openplanet.dev/docs/tutorials/signature-modes))

---

## 3. Scope

**In:**
- Openplanet plugin capturing best finish time per slot per map visit (solo and 1v1 splitscreen).
- Backend ingest endpoint + capture manager.
- Between-maps assignment popup with two templates (solo / 1v1), manual player selection, swap for 1v1.
- Auto-creation of a TM2020 map (`tracks` row) on first sighting.
- Writing `time_entries` (+ a completed `matches` row for 1v1) on the **active session**.
- Reuse of existing reactive Socket.IO broadcasts, leaderboard, and edit flows.

**Out (deferred / non-goals):**
- Tournament-bracket auto-binding (explicitly deferred — assignment is manual for v1).
- Checkpoints/splits, multi-round/match structures, ModeScript game modes.
- Drink/`amount_l` tracking — the chug is performed before the lap, so it is baked into the race time.
- Dedicated-server / XML-RPC / `@evotm/gbxclient` route.
- PS5 / console capture.
- Any new UI design system — reuse existing components only.
- Tournament-bracket auto-binding — assignment stays manual via the "Ubekrefta runder" table.

---

## 4. Architecture

Four independently testable units:

1. **Openplanet plugin** (new; gaming PC; AngelScript) — reads game state, POSTs heat results.
2. **Capture ingest + manager** (new; existing Express backend) — validates, holds pending, commits writes.
3. **Live-capture UI** (new; existing React frontend) — active-session control, pending list, assignment popup.
4. **Existing data layer** (unchanged) — `time_entries`, `matches`, ratings, leaderboard, Socket.IO broadcasts.

```
[Gaming PC]  Trackmania 2020 + Openplanet plugin
     │  best finish time per slot for the current map visit
     │  HTTP POST /api/capture/heat  { token, heatId, mapUid, mapName, playerCount, results:[{slot,bestTimeMs}], serverTime }
     ▼
[Chugmania backend]  CaptureManager
     │  • if no active session → discard (log, 200)        ← per user decision
     │  • auto-create tracks row if mapUid unseen
     │  • persist unconfirmed_laps row(s) (one per slot, linked by heatId; dedupe by heatId)
     │  • broadcast 'all_unconfirmed_laps' (role-aware: admin/mod)
     ▼
[Chugmania frontend]  "Ubekrefta runder" faded table at top of the active session
     │  faded row = time + map, no name/rank; click a row →
     │  popup (solo → 1 dropdown | 1v1 → 2 dropdowns + Swap; time & map read-only)
     │  emit 'confirm_capture' { heatId, assignments:[{slot,userId}] }
     ▼
[Chugmania backend]  confirm
     • write time_entries (source='auto', duration=bestTimeMs) per assigned player on the session
     • for 1v1: write completed matches row (user1,user2,track,session,winner=faster)
     • delete the heat's unconfirmed_laps rows
     • RatingManager.recalculate(); broadcast all_time_entries / all_matches / all_rankings / all_unconfirmed_laps
```

### 4.1 Where the listener lives
The Openplanet plugin **is** the external listener; it replaces the separate Node sibling service from the
original brief. The backend only gains an HTTP ingest route — no second process to run. The plugin ships as
its own repo; the backend/frontend changes ship as a PR to the Chugmania repo (see header **Delivery**).

---

## 5. Components in detail

### 5.1 Openplanet plugin (gaming PC)
- **Mode detection:** read the count of active local player slots in the current playground →
  `playerCount` (1 = solo, 2 = 1v1). Tag every heat with it.
- **Timing:** for each `CSmPlayer` in `CSmArenaClient.Players`, read `ScriptPlayer.RaceWaypointTimes`;
  the final waypoint is the finish time. Track the **best (min) finish time per slot for the current map
  visit**, not every retry.
- **Heat boundary:** emit on map end (player leaves map / map changes). Provide a manual "send now" key
  binding as a fallback in case map-end detection proves unreliable.
- **Map identity:** read `MapUid` and name from the loaded map.
- **Transport:** `Net::HttpPost(captureUrl, json, "application/json")` with a shared `token` and a
  client-generated `heatId` (stable across retries). Retry on failure; `heatId` makes the backend idempotent.
- **Config:** capture URL (localhost or LAN IP of the Chugmania backend) and token, stored in plugin settings.

### 5.2 Capture ingest + manager (backend)
- **Route:** `POST /api/capture/heat` registered in `server.ts` alongside the existing
  `/api/sessions/calendar.ics` Express route; delegates to a new `CaptureManager`.
- **Auth:** shared-secret token (`CAPTURE_TOKEN` env) compared in constant-ish time; reject otherwise.
- **Validation:** shape-check payload (mirror the `isXRequest` guard pattern); reject malformed.
- **No active session → discard:** log a debug line and return `200` so the plugin does not retry. (User
  decision: captures outside an active session are ignored.)
- **Dedupe:** ignore a heat whose `heatId` already exists in `unconfirmed_laps` or has been confirmed.
- **Track auto-create:** if `mapUid` not in `tracks`, insert a TM2020 map row (`mapUid`, `name`, `author`).
- **Persist as unconfirmed:** insert one `unconfirmed_laps` row per slot (linked by `heatId`, carrying
  `slot`, `durationMs`, `playerCount`, `session`, `track`); broadcast `all_unconfirmed_laps`. These survive
  refreshes and restarts — they are the backing store for the "Ubekrefta runder" table.
- **Confirm (`confirm_capture`):** validate assignments (distinct users for 1v1; users exist); write
  `time_entries` (`source='auto'`, `duration=durationMs`, `track`, `session`) per assignment; for 1v1 also
  insert a `matches` row (`status='completed'`, `winner` = faster slot's user); delete the heat's
  `unconfirmed_laps` rows; then `RatingManager.recalculate()` and broadcast
  `all_time_entries`/`all_matches`/`all_rankings`/`all_unconfirmed_laps`.
- **Discard (`discard_capture`):** delete a heat's `unconfirmed_laps` rows without writing (for junk/aborted
  runs); broadcast `all_unconfirmed_laps`.
- **Permissions:** confirming/discarding requires `admin`/`moderator` (reuse `AuthManager.checkAuth`).

### 5.3 Live-capture UI (frontend)
- **Active-session control:** lets an admin mark one session "live for capture" (defaults to today's/nearest
  session). Stored as capture state on the backend; surfaced via `capture_state`.
- **"Ubekrefta runder" table:** rendered at the **top of the active session view** (admin/mod only), styled
  like the existing leaderboard rows but **faded, with no name and no rank** — each faded row shows the
  captured **time + map**. Backed by `all_unconfirmed_laps`. Rows from the same `heatId` are visually linked.
- **Click-to-confirm popup:** clicking a faded row opens a `Dialog` scoped to that heat:
  - **Solo (`playerCount = 1`):** one `NativeSelect` player dropdown; time + map shown read-only.
  - **1v1 (`playerCount = 2`):** two `NativeSelect` dropdowns (one per slot) with each slot's time + map; a
    **Swap** button to exchange which slot maps to which player; confirm.
  - Confirm emits `confirm_capture`; a discard action emits `discard_capture`.
- Built from existing components (`NativeSelect`, `Dialog`, `sonner` toasts). No new design language.
- After confirm, the faded row disappears and the existing leaderboard/match views update through the normal
  broadcast path — auto and manual entries sit on the same leaderboard.

### 5.4 Parallelism guarantee
Auto-capture adds only: one Express route, one manager, new socket events, two nullable-friendly schema
additions, and one UI panel. It changes **no** existing manager, endpoint, or component. Manual time/match
entry, CSV import/export, sessions, and tournaments behave exactly as today. `source` distinguishes the
origin of a row for audit; both kinds coexist on the same leaderboard.

---

## 6. Data model changes

Minimal, "add alongside" — existing Turbo data is preserved.

### `tracks`
- Add `mapUid TEXT UNIQUE` (nullable) — TM2020 MapUid.
- Add `name TEXT` (nullable) — TM2020 map name.
- Add `author TEXT` (nullable) — TM2020 map author.
- Relax `number`, `level`, `type` to **nullable** so a TM2020 map can exist without Turbo attributes.
  Existing Turbo rows keep their values.

### `time_entries`
- Add `source TEXT NOT NULL DEFAULT 'manual'` with type `'manual' | 'auto'`.

### `unconfirmed_laps` (new table — backs the "Ubekrefta runder" list)
- `id` (pk), standard `createdAt`/`updatedAt`/`deletedAt` metadata.
- `session` (FK `sessions`, the active session), `track` (FK `tracks`, the TM2020 map).
- `heatId TEXT NOT NULL` — groups the slot rows belonging to one race; also the idempotency key.
- `slot INTEGER NOT NULL` — 1 or 2.
- `durationMs INTEGER NOT NULL` — the captured best time for that slot.
- `playerCount INTEGER NOT NULL` — 1 (solo) or 2 (1v1); drives the popup template.
- Rows are created on ingest and deleted on confirm/discard. They are never shown on the leaderboard (only
  in the faded table) and never feed ratings until confirmed into `time_entries`.

### Process
- Run `npm run db:gen` to generate the Drizzle migration after editing `schema.ts`.
- Add the new table/columns to `AdminManager` `TABLE_MAP` / `EXCLUDED_COL_EXPORT` per `AGENTS.md` so CSV
  import/export stays complete.

### No change to `users`
Slots are assigned to players manually each heat, so no TM-login/AccountId field is required.

---

## 7. Socket.IO & HTTP contract additions

- **HTTP** `POST /api/capture/heat` (token-auth, **versioned contract**) — body in §4. The JSON schema is
  documented in the Chugmania repo and consumed by the separate plugin repo; bump a `contractVersion` field
  when it changes so plugin and backend can evolve independently.
- **Server→client** `capture_state` (active session + config), `all_unconfirmed_laps` (the faded-table
  list for the active session). Emitted role-aware to admin/mod only.
- **Client→server** `set_active_session` (mark/clear the live session), `confirm_capture`
  (`{ heatId, assignments:[{slot,userId}] }`), `discard_capture` (`{ heatId }`).
- All follow the existing `setup(s, event, handler)` wiring and `Result<T>`/`SuccessResponse|ErrorResponse`
  conventions.

---

## 8. Edge handling

- **No active session:** discard (log, 200). No retry, no queue.
- **Duplicate heat:** deduped by `heatId` (unconfirmed or already confirmed).
- **Plugin/HTTP failure:** plugin retries with the same `heatId`; backend is idempotent.
- **Backend restart mid-session:** unconfirmed laps are **persisted in the DB**, so the "Ubekrefta runder"
  table survives restarts and page refreshes; only the active-session pointer is re-set by the admin.
- **Wrong map / wrong player:** correctable before confirm (pick correctly / discard) and after confirm via
  the existing time-entry and match edit flows.
- **Unassigned captures:** remain as faded rows until confirmed or explicitly discarded; never auto-write.
- **>2 players:** out of scope for v1 templates; backend logs and discards.

---

## 9. Human prerequisites (cannot be done by the implementer)

1. **Feasibility spike (T0 — the one real unknown):** install Openplanet on the gaming PC, run a 2-player
   splitscreen Time Attack, and confirm a probe plugin sees **both** slots and their `RaceWaypointTimes`.
   This gates the plugin build. If it fails, fall back to a replay-file watcher (`Autosave Ghosts` plugin +
   GBX.NET parsing), accepting non-real-time capture.
2. **Club Access (~$20/yr)** on the gaming PC for Openplanet Developer mode (or sign the plugin).
3. Record real heat payloads during T0 to use as golden fixtures for automated tests.

---

## 10. Why this replaces the original brief

The original brief specified a dedicated server + XML-RPC + `@evotm/gbxclient` listener, on the assumption
that players connect as clients to a server. Research showed (a) PS5 can't participate at all, and (b)
TM2020's local splitscreen — the most couch-friendly setup, and what the group actually wants — has no
server and no XML-RPC. Client-side Openplanet capture is simpler (one PC, no server to stand up, free-tier
play), fits couch 1v1 better, and removes the entire LAN-server prerequisite chain. The seat→player binding
insight from the brief survives; only the capture transport changed.

---

## 11. Test execution plan

- **T0 — Feasibility spike** (manual, gaming PC). Probe plugin prints `Players.Length`, each slot's
  name/index, and `RaceWaypointTimes` during 2-player splitscreen and hotseat. Record real payloads as
  golden fixtures. Directly mitigates the "verify against the running game / docs drift" risk.
- **T1 — Backend logic unit tests** (`*.spec.ts` via `tsx`): payload validation; best-time selection;
  solo-vs-1v1 routing; `unconfirmed_laps` creation; slot→player binding + swap; winner derivation;
  idempotency/dedupe by `heatId`; no-active-session discard; track auto-create; confirm deletes the heat's
  unconfirmed rows.
- **T2 — Ingest integration tests:** a `mock-plugin` script POSTs recorded/synthetic fixtures to
  `/api/capture/heat`; assert `unconfirmed_laps` rows + `all_unconfirmed_laps` broadcast, then drive
  `confirm_capture` and assert `time_entries`/`matches` rows and broadcasts — full loop **without the game
  running**. This is what lets the Chugmania PR be verified standalone.
- **T3 — Plugin manual tests** (gaming PC): finish detection; best-of-retries; map-end trigger;
  HTTP retry while backend is down then recovers.
- **T4 — Full manual E2E protocol** (real setup, checklist): solo run → faded "Ubekrefta runder" row →
  click → assign → leaderboard row; 1v1 → two linked faded rows → confirm with swap → two entries + match
  winner; capture while no session active → ignored; backend restart → faded rows persist; manual entry
  still works alongside.
- **T5 — Reliability/edge:** duplicate finishes; plugin reconnect; discard junk capture; post-confirm
  correction via edit flow; parallel manual + auto entries on the same session/leaderboard.

---

## 12. Open items to confirm during implementation (Phase 1 findings)

- Exact current mechanism for how a manual time entry selects its session (to mirror for "active session").
- Precise `matches` write for a 1v1 result (single `duration` column vs the two per-player `time_entries`).
- Whether map-end is reliably detectable in the plugin, or the manual "send now" trigger should be primary.
