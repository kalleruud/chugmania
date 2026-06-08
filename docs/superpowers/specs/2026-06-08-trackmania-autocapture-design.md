# Chugmania — Trackmania 2020 Auto-Capture (v1 Design)

**Date:** 2026-06-08
**Status:** Approved design, pending implementation plan
**Supersedes:** `CHUGMANIA_AUTOCAPTURE_PLAN.md` (the original brief assumed a dedicated-server/XML-RPC architecture; this document replaces that architecture wholesale — see §10).

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
- Persisting unassigned captures across restarts (pending lives in memory for v1).

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
     │  • create in-memory pending capture (dedupe by heatId)
     │  • emit 'capture_pending' to admin/mod clients
     ▼
[Chugmania frontend]  Live-capture popup
     │  solo → 1 player dropdown | 1v1 → 2 dropdowns + Swap; time & map prefilled
     │  emit 'commit_capture' { pendingId, assignments:[{slot,userId}] }
     ▼
[Chugmania backend]  commit
     • write time_entries (source='auto', duration=bestTimeMs) per assigned player on active session
     • for 1v1: write completed matches row (user1,user2,track,session,winner=faster)
     • RatingManager.recalculate(); broadcast all_time_entries / all_matches / all_rankings
```

### 4.1 Where the listener lives
The Openplanet plugin **is** the external listener; it replaces the separate Node sibling service from the
original brief. The backend only gains an HTTP ingest route — no second process to run.

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
- **Dedupe:** ignore a heat whose `heatId` is already pending or already committed.
- **Track auto-create:** if `mapUid` not in `tracks`, insert a TM2020 map row (`mapUid`, `name`, `author`).
- **Pending model:** in-memory map of `pendingId → { heatId, sessionId, trackId, playerCount, results }`.
  Emit `capture_pending` to admin/mod sockets.
- **Commit (`commit_capture`):** validate assignments (distinct users for 1v1; users exist); write
  `time_entries` (`source='auto'`, `duration=bestTimeMs`, `track`, `session`=active) per assignment; for
  1v1 also insert a `matches` row (`status='completed'`, `winner` = faster slot's user); then
  `RatingManager.recalculate()` and the three existing broadcasts. Remove the pending entry.
- **Permissions:** committing requires `admin`/`moderator` (reuse `AuthManager.checkAuth`).

### 5.3 Live-capture UI (frontend)
- **Active-session control:** lets an admin mark one session "live for capture" (defaults to today's/nearest
  session). Stored as capture state on the backend; surfaced via `capture_state`.
- **Pending popup:** on `capture_pending`, show the template by `playerCount`:
  - **Solo:** one `NativeSelect` player dropdown; prefilled time + map (read-only).
  - **1v1:** two `NativeSelect` dropdowns (one per slot) showing each slot's time + map; a **Swap** button to
    exchange which slot maps to which player; confirm.
- Built from existing components (`NativeSelect`, `Dialog`, `sonner` toasts). No new design language.
- After commit, the existing leaderboard/match views update through the normal broadcast path.

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

### Process
- Run `npm run db:gen` to generate the Drizzle migration after editing `schema.ts`.
- Add the new columns to `AdminManager` `TABLE_MAP` / `EXCLUDED_COL_EXPORT` per `AGENTS.md` so CSV
  import/export stays complete.

### No change to `users`
Slots are assigned to players manually each heat, so no TM-login/AccountId field is required.

---

## 7. Socket.IO & HTTP contract additions

- **HTTP** `POST /api/capture/heat` (token-auth) — body in §4.
- **Server→client** `capture_state` (active session + config), `capture_pending` (a pending capture to
  assign). Emitted role-aware to admin/mod only.
- **Client→server** `set_active_session` (mark/clear the live session), `commit_capture`
  (`{ pendingId, assignments }`), `discard_pending` (`{ pendingId }`).
- All follow the existing `setup(s, event, handler)` wiring and `Result<T>`/`SuccessResponse|ErrorResponse`
  conventions.

---

## 8. Edge handling

- **No active session:** discard (log, 200). No retry, no queue.
- **Duplicate heat:** deduped by `heatId` (pending or committed).
- **Plugin/HTTP failure:** plugin retries with the same `heatId`; backend is idempotent.
- **Backend restart mid-session:** in-memory pending is lost (acceptable for v1 — a heat is assigned within
  seconds); active-session selection is re-set by the admin. Persisting pending is flagged as later hardening.
- **Wrong template / wrong map / wrong player:** correctable after the fact via the existing time-entry and
  match edit flows.
- **Unassigned pending:** stays until committed or explicitly discarded; never auto-writes.
- **>2 players:** out of scope for v1 templates; backend logs and discards (or holds without a template).

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
  solo-vs-1v1 routing; slot→player binding + swap; winner derivation; idempotency/dedupe by `heatId`;
  no-active-session discard; track auto-create.
- **T2 — Ingest integration tests:** a `mock-plugin` script POSTs recorded/synthetic fixtures to
  `/api/capture/heat`; assert DB rows, `matches` rows, and emitted socket events — full loop **without the
  game running**.
- **T3 — Plugin manual tests** (gaming PC): finish detection; best-of-retries; map-end trigger;
  HTTP retry while backend is down then recovers.
- **T4 — Full manual E2E protocol** (real setup, checklist): solo run → leaderboard row; 1v1 → two rows +
  match winner + swap correctness; capture while no session active → ignored; backend restart recovery;
  manual entry still works alongside.
- **T5 — Reliability/edge:** duplicate finishes; plugin reconnect; wrong-template correction via edit flow;
  parallel manual + auto entries on the same session/leaderboard.

---

## 12. Open items to confirm during implementation (Phase 1 findings)

- Exact current mechanism for how a manual time entry selects its session (to mirror for "active session").
- Precise `matches` write for a 1v1 result (single `duration` column vs the two per-player `time_entries`).
- Whether map-end is reliably detectable in the plugin, or the manual "send now" trigger should be primary.
