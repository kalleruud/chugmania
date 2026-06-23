# Tournament feature — Playwright MCP test cases

Step-by-step cases derived from [TOURNAMENT_FEATURE.md](./TOURNAMENT_FEATURE.md). Intended for autonomous agents using the **user-playwright** MCP server (tools prefixed `browser`\_).

## How to run these tests

1. **Base URL**: Set `BASE_URL` to the running app (local default from AGENTS.md: `http://localhost:6996`). Substitute `{BASE_URL}` in steps.
2. **Accounts**: Maintain at least two fixtures:

- **AdminOrMod**: user with admin or moderator role.
- **RegularUser**: user without those roles, but able to view target sessions.

3. **Session fixtures**: Symbolic names below; **resolve real `SESSION_ID` values from the database** (see [Finding session and participant test data](#finding-session-and-participant-test-data)).

- `S_CANCELLED`: cancelled session (tournament actions should fail).
- `S_SMALL`: fewer than four confirmed `yes` signups (preview/create blocked).
- `S_VALID`: at least four confirmed `yes` signups, not cancelled, no active tournament.
- `S_WITH_TOURNAMENT`: at least four `yes`, not cancelled, **has** an active tournament row.
- `S_MANY`: non-cancelled session with **many** `yes` signups (prefer **8+** for double elimination, multi-group, and heavy bracket UI scenarios).

4. **Playwright MCP workflow** (mandatory for agents):

- Call `browser_tabs` with `action: "list"` before first navigation if a tab may already exist.
- After every navigation or UI change that can alter structure, call `browser_snapshot` and use **exact `ref` targets** from the latest snapshot for `browser_click`, `browser_type`, `browser_select_option`, etc.
- After form changes that trigger debounced preview (~380 ms), call `browser_wait_for` with `time: 1` or wait for distinctive preview text, then snapshot again.
- Use `browser_wait_for` with `text` for toasts and post-submit redirects.
- Use `browser_take_screenshot` only when a visual assertion is required; primary assertions should use snapshot text and structure.
- On native `<select>` elements, use `browser_select_option`; for custom comboboxes, follow snapshot roles (may require `browser_click` + `browser_click` on option).

5. **Pass/fail**: A step **fails** if expected text or control state is absent in the snapshot, if the app shows an unexpected error toast, or if network/console shows a 4xx/5xx for the exercised action (`browser_network_requests` / `browser_console_messages` when debugging).

---

## Finding session and participant test data

Tournament rules use **confirmed participants** = session signups with `response = 'yes'` (see spec §5.1). Use the **SQLite** database the backend opens as `data/db.sqlite` **relative to the process working directory**. Scripts in this repo (`npm run dev`, `npm run db:migrate`, `npm run db:studio`) run with cwd = **repository root**, so the file is:

`{REPO_ROOT}/data/db.sqlite`

If `sqlite3` fails to open the file, confirm the app’s cwd or env (some setups symlink or copy the DB).

**Shell** (from repo root):

```bash
sqlite3 data/db.sqlite
```

**GUI**: `npm run db:studio` (Drizzle Studio).

**Navigate in the app**: `{BASE_URL}/sessions/{SESSION_ID}` — use the `sessions.id` UUID from the queries below.

### Accounts (AdminOrMod, RegularUser)

```sql
SELECT id, email, first_name, role
FROM users
WHERE deleted_at IS NULL AND role IN ('admin', 'moderator')
LIMIT 10;

SELECT id, email, first_name, role
FROM users
WHERE deleted_at IS NULL AND role = 'user'
LIMIT 10;
```

Pick one row each for **AdminOrMod** and **RegularUser**; log in through whatever auth flow the environment uses.

### Sessions ranked by confirmed participant count (`yes`)

Use this to pick **`S_MANY`**, stress cases, and sessions where group/advancement options are rich.

```sql
SELECT
  s.id,
  s.name,
  s.status,
  s.date,
  SUM(CASE WHEN ss.response = 'yes' THEN 1 ELSE 0 END) AS yes_count,
  SUM(CASE WHEN ss.response = 'maybe' THEN 1 ELSE 0 END) AS maybe_count,
  SUM(CASE WHEN ss.response = 'no' THEN 1 ELSE 0 END) AS no_count,
  EXISTS (
    SELECT 1 FROM tournaments t
    WHERE t.session = s.id AND t.deleted_at IS NULL
  ) AS has_tournament
FROM sessions s
LEFT JOIN session_signups ss
  ON ss.session = s.id AND ss.deleted_at IS NULL
WHERE s.deleted_at IS NULL
GROUP BY s.id
ORDER BY yes_count DESC, s.date DESC;
```

Prefer rows at the top for **`S_MANY`** and for scenarios needing **8+** `yes` (double elimination, larger brackets). Document the chosen `id` in run notes.

### Map rows to fixture symbols

| Symbol              | SQL filter (having computed `yes_count`, `has_tournament`, `s.status`)  |
| ------------------- | ----------------------------------------------------------------------- |
| `S_CANCELLED`       | `s.status = 'cancelled'`                                                |
| `S_SMALL`           | `yes_count < 4` and `s.status != 'cancelled'`                           |
| `S_VALID`           | `yes_count >= 4` and `s.status != 'cancelled'` and `has_tournament = 0` |
| `S_WITH_TOURNAMENT` | `yes_count >= 4` and `has_tournament = 1`                               |
| `S_MANY`            | `yes_count >= 8` (or highest available `yes_count`) and not cancelled   |

If no row matches `S_VALID`, use a session with `yes_count >= 4` and **delete** the tournament in-app (admin) or seed data accordingly, then reuse the same `id`.

### Quick lookups

**Active tournament for a session** (verify `S_WITH_TOURNAMENT`):

```sql
SELECT t.id AS tournament_id, t.session, t.name, t.elimination_type
FROM tournaments t
WHERE t.deleted_at IS NULL AND t.session = 'PASTE_SESSION_UUID';
```

**Cancelled sessions** (candidates for `S_CANCELLED`):

```sql
SELECT id, name, status FROM sessions
WHERE deleted_at IS NULL AND status = 'cancelled'
ORDER BY date DESC;
```

Re-run the ranked query **before** a test batch if signups change; `yes_count` drives valid tournament configurations.

---

## Specification coverage matrix

Every numbered subsection of [TOURNAMENT_FEATURE.md](./TOURNAMENT_FEATURE.md) must map to at least one test (or explicit **engineering-only** note). Rows marked **Eng** are enforced by unit/integration tests or code review, not required for Playwright MCP passes.

| Spec                                                | Covered by                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------------- |
| §1 Overview (matches everywhere, single read model) | S-03, M-03, R-01, **Eng**: API shape                                            |
| §2 Domain language                                  | (definitions only)                                                              |
| §3 Capabilities                                     | C-_, D-_, MC-_, P-_, U-01                                                       |
| §4 Lifecycle monotonicity                           | L-01, MC-04, D-01                                                               |
| §5 Configuration                                    | C-01, C-07, C-10, C-11, C-14, V-02, V-04–V-08                                   |
| §5.1 Derived constraints                            | V-02, V-04, V-07, C-07, C-14                                                    |
| §5.2 Stage track configuration                      | C-03, C-11, T-01, T-02                                                          |
| §6 Qualification                                    | Q-01–Q-04, C-04, **Eng**: ranking math                                          |
| §6.1 Optionality / stable ranking                   | Q-02, L-01                                                                      |
| §6.2–6.3 Ranking / tiebreak                         | Q-01, Q-04, GS-02, **Eng**: `tournament-draft.spec.ts` / standings              |
| §6.4 Display                                        | Q-01, Q-03                                                                      |
| §7 Groups                                           | GR-01, **Eng**: snake                                                           |
| §7.2 Group naming                                   | GR-01                                                                           |
| §8 Group play                                       | GR-02, M-01, GS-02, GS-03                                                       |
| §8.3 Standings                                      | GS-01–GS-03, MC-01                                                              |
| §9 Bracket                                          | B-01–B-04, M-02, M-04, MC-02–MC-06                                              |
| §9.1–9.2 Seeding / pairing                          | B-04, **Eng**: golden draft                                                     |
| §9.3 Single elim                                    | B-02                                                                            |
| §9.4 Double elim                                    | B-01                                                                            |
| §9.4.1 DE list order                                | **Eng**: `tournament-draft.spec.ts`                                             |
| §9.5 Stage naming                                   | B-03                                                                            |
| §9.6–9.7 Dependencies / labels                      | M-02, M-04, M-05, B-03, V-13                                                    |
| §10 Slot resolution                                 | MC-02–MC-07                                                                     |
| §11 Track distribution                              | T-01, T-02, **Eng**: rotation math                                              |
| §12 Preview                                         | C-01, C-02, C-08, C-09, C-12, C-13, C-16, C-17, M-03, Q-01                      |
| §13 Creation                                        | C-03–C-05, C-09, C-15, V-\*                                                     |
| §14 Match completion flow                           | MC-01–MC-07                                                                     |
| §15 Deletion                                        | D-01–D-05                                                                       |
| §16 Session layout                                  | G-01, S-01–S-02, U-01–U-02                                                      |
| §16.1 Session tab                                   | S-01, S-02                                                                      |
| §16.2 Participants                                  | U-01                                                                            |
| §16.3 Tournament tab                                | G-02, G-03, U-02                                                                |
| §16.4 Standings layout                              | GS-01                                                                           |
| §17 Permissions                                     | P-01–P-05, C-06, D-02, R-06                                                     |
| §18 Validation                                      | V-01–V-13, C-03, C-12, C-15                                                     |
| §19 Realtime                                        | R-01–R-07                                                                       |
| §20 Out of scope                                    | O-01                                                                            |
| §21 Architecture / invariants                       | **Eng**: module tests + ADR; C-16–C-17, **Eng**: `workloadSummary` math (§21.6) |

---

## Global smoke

### G-01 — Session screen has three tabs

**Preconditions**: Logged in as any user; open a session detail URL `{BASE_URL}/sessions/{SESSION_ID}` (adjust path to match app routing).

**Steps**

1. `browser_navigate` to the session URL.
2. `browser_snapshot` the page.
3. In the snapshot, locate tab controls or links whose accessible names correspond to **Session**, **Participants**, and **Tournament** (or localized equivalents).

**Expected**

- All three tabs are present and one is active.

### G-02 — Tournament tab without tournament (admin)

**Preconditions**: `SESSION_ID` = `S_VALID`. Logged in as **AdminOrMod**.

**Steps**

1. Navigate to session; open **Tournament** tab (`browser_click` on tab target from snapshot).
2. `browser_snapshot`.

**Expected**

- Copy or control clearly offers **Create tournament** (or localized equivalent) linking to the create flow for this session.

### G-03 — Tournament tab without tournament (regular user)

**Preconditions**: `SESSION_ID` = `S_VALID`. Logged in as **RegularUser**.

**Steps**

1. Open session **Tournament** tab.
2. `browser_snapshot`.

**Expected**

- No **Create tournament** entry point.
- Empty or informational state consistent with “no tournament” (no admin-only actions visible).

---

## Session tab vs tournament (§16.1, §1)

### S-01 — Session tab lists only non-tournament matches

**Preconditions**: `S_WITH_TOURNAMENT`; at least one tournament match and one ordinary session match exist (seed data).

**Steps**

1. Open session **Session** tab (not Tournament).
2. `browser_snapshot` the matches / activity region.

**Expected**

- Ordinary session matches appear as before.
- Tournament-only matches do **not** appear in the non-tournament match list (§16.1). If product surfaces them elsewhere on the same tab, document deviation — spec says non-tournament list.

### S-02 — Per-track leaderboards unchanged with tournament present

**Preconditions**: `S_WITH_TOURNAMENT`; session has lap times on multiple tracks.

**Steps**

1. On **Session** tab, interact with track filter / leaderboard controls exactly as in pre-tournament flows.
2. `browser_snapshot` after each filter change.

**Expected**

- Leaderboards still use same components and filters; data loads without error (§16.1).

### S-03 — Tournament match visible in another match surface (§1)

**Preconditions**: App exposes a global matches list, home feed, track page, or user history where session matches appear (discover in routing).

**Steps**

1. Note a tournament match label from **Tournament** tab.
2. Navigate to the other surface; search or scroll for that match.

**Expected**

- Tournament match appears wherever normal matches for that session are listed, with consistent labeling (overview §1). If no such surface exists, mark **N/A** and rely on match editor deep link.

---

## Participants tab (§16.2, §3)

### U-01 — Self RSVP and signup summary

**Preconditions**: Logged-in **RegularUser** invited to `S_VALID`; user not yet `yes` or changeable.

**Steps**

1. Open session **Participants** tab.
2. `browser_snapshot`; locate yes/maybe/no controls for current user.
3. `browser_click` a different RSVP option; confirm toast or updated state.
4. Snapshot again; read summary counts (yes / maybe / no).

**Expected**

- Self-RSVP module works (§16.2).
- Summary counts reflect responses (§16.2). Totals update after change.

---

## Tournament tab — progress readout (§16.3)

### U-02 — Progress summaries when tournament exists

**Preconditions**: `S_WITH_TOURNAMENT`.

**Steps**

1. Open **Tournament** tab.
2. `browser_snapshot` full page.

**Expected**

- Besides qualification, standings, and matches, UI surfaces **progress** summary fields from `tournament details` (wording varies: e.g. completed counts, stage progress). If read model omits a visible summary in UI, flag product gap against §16.3.

---

## Create tournament page & preview

### C-01 — Create page loads and shows form + preview region

**Preconditions**: **AdminOrMod**; `S_VALID`.

**Steps**

1. Open session `{BASE_URL}/sessions/{SESSION_ID}`; switch to **Tournament** tab; `browser_click` **Create tournament** (or equivalent) from snapshot.
2. `browser_snapshot` the resulting page (dedicated route, dialog, or inline — implementation may vary).

**Expected**

- Fields for tournament **name**, **description** (if present), **qualification track** (single-select via shared **`Combobox`**), **groups count**, **advancement count**, **elimination type** (non-search control such as **`NativeSelect`**), and **per-stage tracks** for stages that apply (ordered multi-select via shared **`ComboboxMulti`** per §5, §21.7).
- A preview pane occupies remaining horizontal space: bounded form column, flexible preview column (`grid` / `1fr`, `min-w-0` where needed per §12). Snapshot may show qualification, groups, bracket regions.

### C-02 — Preview updates after form change (debounce)

**Preconditions**: Same as C-01.

**Steps**

1. Snapshot; note a distinguishing string in preview (e.g. stage name or match count) if visible.
2. Change **groups count** or **advancement** via `browser_select_option` or UI-specific clicks.
3. `browser_wait_for` `time: 1` (or until preview heading/text changes).
4. `browser_snapshot`.

**Expected**

- Preview content changes to reflect new configuration without full page reload.
- If a loading indicator is specified in spec, it may appear briefly; final snapshot reflects new draft.

### C-03 — Submit disabled or blocked until every draft match has a track

**Preconditions**: Same as C-01. Configure a valid combination but **leave at least one used stage without a selected track** (per spec §13).

**Steps**

1. Fill name and required selects with valid values.
2. Intentionally omit track(s) for one used stage.
3. Wait for debounced preview.
4. `browser_snapshot`; attempt `browser_click` on submit button.

**Expected**

- Submit control is disabled **or** click does not navigate / does not create tournament.
- No successful creation toast; session still has no tournament (verify via API or by navigating back to session).

### C-04 — Successful creation returns to session with toast

**Preconditions**: **AdminOrMod**; `S_VALID`; all used stages have at least one track; valid elimination and group settings.

**Steps**

1. Complete form with valid data; ensure preview has finished loading (no perpetual spinner).
2. `browser_click` submit.
3. `browser_wait_for` success toast text or session URL pattern.
4. `browser_snapshot` on session page.

**Expected**

- Navigation to session view (or tournament tab) with confirmation toast.
- **Tournament** tab now shows tournament details (not empty admin create card).

### C-05 — Create rejected when tournament already exists

**Preconditions**: **AdminOrMod**; `S_WITH_TOURNAMENT`.

**Steps**

1. Attempt second create: deep-link if router exposes it, or use browser history / manual URL only if product allows; otherwise assert **Create tournament** is absent when tournament already shown.
2. If create UI is reachable, fill validly and submit.

**Expected**

- Backend validation error surfaced via toast (localized); no second active tournament. Verify session still shows single tournament.

### C-06 — Preview/create forbidden for non-admin

**Preconditions**: **RegularUser**; `S_VALID`.

**Steps**

1. Attempt to open create flow: direct URL if known from codebase, or any **Create tournament** control (should be absent per G-03).
2. `browser_snapshot`.

**Expected**

- Redirect, error page, or disabled experience; user cannot obtain authoritative preview payload (mirror backend §17).

### C-07 — Elimination type change snaps invalid groups/advancement

**Preconditions**: Create page; fixture where switching `single` ↔ `double` invalidates current pair (§5.1).

**Steps**

1. Set groups + advancement to a combination valid only for one elimination type.
2. `browser_click` / select the other **elimination type**.
3. `browser_wait_for` debounce; `browser_snapshot`.

**Expected**

- Groups and/or advancement values **silently** snap to a still-valid combination (no stuck invalid state). Double elimination unavailable when no 4/8 advancer combo exists — control disabled (§5.1).

### C-08 — Preview loading: spinner without blanking prior draft

**Preconditions**: Create page; throttle network in Playwright context if supported, or rapidly change fields.

**Steps**

1. Load a stable preview; snapshot.
2. Change a field that invalidates preview; immediately snapshot again (may catch loading state).

**Expected**

- While new preview in flight, loading indicator visible **or** brief stale content (§12). Prior preview must not be replaced by empty error layout until response arrives.

### C-09 — Create gated until preview idle

**Preconditions**: Create page; use devtools throttling or slow 3G so preview request is slow.

**Steps**

1. Change form to trigger new preview.
2. Immediately attempt submit (before preview completes).

**Expected**

- Submit disabled **or** ignored until latest preview resolved and not loading (§13).

### C-10 — Optional description persists

**Preconditions**: Valid create path.

**Steps**

1. Enter non-empty **description**; complete remaining fields and tracks; create tournament.
2. Reload session tournament details (hard refresh).

**Expected**

- Description appears in tournament header or details (§5). Empty description allowed.

### C-11 — Unused stage track UI pruned when stage disappears

**Preconditions**: Create page; configuration that uses stage `eight` at one advancer count then hides it when count changes (§5.2).

**Steps**

1. Select groups/advancement so a high round (e.g. round of 16) appears; set tracks for that stage in UI.
2. Change to smaller advancer field so that stage is no longer in draft.
3. `browser_snapshot` track configuration section.

**Expected**

- Controls for the obsolete stage are **hidden**. Returning to a config that needs the stage does not resurrect stale random tracks without user action (pruned server-side — verify after create or via re-open create if supported).

### C-12 — Preview tolerates missing tracks; create does not

**Preconditions**: Create page; valid config except one used stage lacks tracks.

**Steps**

1. Omit tracks for one stage; wait for preview.
2. `browser_snapshot` preview pane — note matches with empty/missing track display if shown.
3. Attempt create (should fail per C-03).

**Expected**

- Preview **still renders** draft with possible null-track rows (§18: create-only track rule). Create remains blocked (C-03).

### C-13 — Large viewport: sticky preview column

**Preconditions**: Create page; viewport width ≥ typical desktop (`browser_resize`).

**Steps**

1. Scroll page vertically if form is long.
2. `browser_take_screenshot` or snapshot noting preview pane visibility.

**Expected**

- Preview column remains usable while scrolling (§12). **N/A** on narrow viewports.

### C-14 — Numeric configuration controls list only valid combinations

**Preconditions**: Create page; fixture with known participant count where some group / advancement values would violate §5.1.

**Steps**

1. Open groups count and advancement count controls.
2. Snapshot listed options for each elimination type.
3. Change elimination type and snapshot options again.

**Expected**

- Groups count and advancement controls omit combinations that violate participant count, floor, power-of-two, and double-elim advancer rules (§5.1).
- Double elimination option is disabled when no 4- or 8-advancer configuration is reachable.

### C-16 — Preview header shows workload summary, not name or description

**Preconditions**: Same as C-01; form has a non-empty **name** and optional **description** filled.

**Steps**

1. Wait for debounced preview after fields are set.
2. `browser_snapshot` the preview pane **header** region (`TournamentPanel` with preview / `isPreview`).

**Expected**

- Preview header does **not** show the tournament **name** or **description** (§12).
- Preview header surfaces **`workloadSummary`** from the read model: **distinct track count** (qualification track plus every distinct track id on draft matches), **qualification laps per player** (one attempt each), and **minimum–maximum tournament matches per player** (structural bounds for the format — group sizes, bracket caps, elimination type — not live resolution).
- Below the header, progress lines for overall / group match counts may still appear (§12).

### C-17 — Live tournament tab header keeps title and description

**Preconditions**: `S_WITH_TOURNAMENT` or immediately after C-04; **AdminOrMod** or **RegularUser** with view access.

**Steps**

1. Open session **Tournament** tab (live details, not create preview).
2. `browser_snapshot` the tournament panel header.

**Expected**

- **Name** and **description** (when stored) appear as the normal tournament title/header copy (§12 live path).
- Contrast C-16: live header must not be “workload-only” with name hidden. If UI also displays `workloadSummary`, that is optional; spec requires it on the payload for clients (§12, §21.6).

### C-15 — Failed create is atomic

**Preconditions**: **Eng** primary; use API/integration harness or request interception to force a persistence failure after the tournament row is attempted but before all dependent records are saved.

**Steps**

1. Submit an otherwise valid create request.
2. Force failure during dependent persistence (stage tracks, groups, group players, tournament-match rows, or underlying matches).
3. Reload session tournament details and relevant match/session lists.

**Expected**

- No active tournament remains.
- No partial stage-track, group, group-player, tournament-match, or underlying tournament match records are visible (§13).
- A localized error is surfaced and subsequent valid create can still succeed.

---

## Qualification display (UI)

### Q-01 — Qualification list uses leaderboard row pattern

**Preconditions**: Tournament exists or preview open; at least one participant with qualification lap and one without (if data available).

**Steps**

1. Open tournament details (live on **Tournament** tab or preview on create page).
2. `browser_snapshot` on qualification section.

**Expected**

- Rows consistent with `TimeEntryRow` behavior: timed rows show position; pending rows show pending labeling (e.g. Norwegian “Venter” per spec example) and no position number.
- If gap toggle exists in snapshot, `browser_click` it and snapshot again — gap display changes.

### Q-02 — Tournament can exist before any qualification lap

**Preconditions**: `S_VALID`; no participant has a valid lap on the chosen qualification track.

**Steps**

1. Create tournament with valid configuration (C-04 path).
2. Open **Tournament** tab qualification list.

**Expected**

- Creation succeeds (§6.1). All participants appear as **pending** in qualification (or equivalent), not as errors.

### Q-03 — Pending row distinct from DNF

**Preconditions**: Fixture with one user DNF/invalid lap and one user with no lap on qualification track (if app surfaces DNF in qualification list).

**Steps**

1. Open qualification in **Tournament** tab or preview.
2. `browser_snapshot`.

**Expected**

- Never-run lap shows **pending** styling (§6.4). True DNF (if shown) differs from pending. If UI cannot represent DNF separately, document.

### Q-04 — Qualification ranking ignores invalid laps and orders untimed participants

**Preconditions**: **Eng** primary or UI fixture with participants who have: a valid lap on the qualification track/session, a deleted lap, a zero-duration lap, a lap on another track/session, and no valid lap.

**Steps**

1. Open preview or tournament qualification section.
2. Snapshot displayed qualification order and pending/timed state.

**Expected**

- Only non-deleted, non-zero laps on the tournament qualification track for the same session count as valid (§6.2).
- Timed participants sort by best valid lap duration ascending, with `userId` as stable tiebreak.
- Untimed participants come after all timed participants, sorted **worst-rated → best-rated** using global `Ranking`: `ranking` ascending, then `totalRating` ascending, then `userId` (§6.2).
- Display ranks are contiguous across timed and pending segments; pending rows show no position number (§6.2, §6.4).

---

## Groups & naming (§7)

### GR-01 — Group letters and membership in preview/details

**Preconditions**: Tournament or preview with `groupsCount ≥ 2`.

**Steps**

1. Open preview or **Tournament** tab groups section.
2. `browser_snapshot`.

**Expected**

- Groups named **A**, **B**, **C**, … (§7.2). Participant names appear under expected group (spot-check against known snake for seeded data, or **Eng** golden test).

### GR-02 — Round-robin match count spot-check

**Preconditions**: Known group size `n` (e.g. 4 players in group A).

**Steps**

1. Count group-stage matches involving only group A in ordered match list (or filter by label).

**Expected**

- Count equals `n × (n − 1) / 2` (§8.1).

---

## Groups & standings

### GS-01 — One standings block per group; responsive hint

**Preconditions**: Tournament with multiple groups (e.g. groups count > 1).

**Steps**

1. Open **Tournament** tab.
2. `browser_snapshot`; locate standings grouped by **Group A**, **Group B**, etc.

**Expected**

- Distinct blocks per group with column headers / ranks.
- Optional: resize with `browser_resize` to assert single-column vs two-column at `xl` (if snapshot exposes layout class names; otherwise screenshot comparison).

### GS-02 — Standings with zero completed matches still show order

**Preconditions**: Freshly created tournament; no group match completed.

**Steps**

1. Open **Tournament** tab.
2. Snapshot standings for one group.

**Expected**

- Every group member listed with rank; ordering follows qualification-based tiebreak (exact order may be asserted if test data ranks are known).

### GS-03 — `qualifies` / advancer marking

**Preconditions**: `S_WITH_TOURNAMENT`; `advancementCount` known (e.g. top 2 advance).

**Steps**

1. Snapshot standings for one group before any match completes.
2. Complete matches so standings reorder.
3. Snapshot again.

**Expected**

- Rows that rank `≤ advancementCount` show qualifies indicator (badge, highlight, or copy — per UI). Non-qualifiers lack it (§8.3).

---

## Bracket shape & stage naming (§9)

### B-01 — Double elimination exposes upper, lower, grand final

**Preconditions**: Create or view tournament with `double` elimination and total advancers **8** (or **4**).

**Steps**

1. Open **Tournament** tab or preview; `browser_snapshot` bracket region.

**Expected**

- Visible structure consistent with §9.4: upper-bracket matches, lower-bracket stages (e.g. loser quarter / semi / final per depth), and **grand final** (or localized equivalents). Not identical to single-elim tree.

### B-02 — Single elimination has no lower bracket

**Preconditions**: Same participant count with `single` elimination tournament.

**Steps**

1. Snapshot bracket section.

**Expected**

- No lower-bracket / loser-bracket block (§9.3). Final is terminal upper path.

### B-03 — Stage labels and ordinals for duplicate stages

**Preconditions**: Bracket with two matches in same stage (e.g. two quarter-finals).

**Steps**

1. Snapshot two sibling matches in that stage.

**Expected**

- Localized stage name; when multiple matches share stage, **ordinal** suffix **Semi-final 2** style (§9.5, §9.7). Single-match stage omits redundant ordinal.

### B-04 — Advancer seeding and first-round pairing

**Preconditions**: Known fixture with multiple groups and known standings; use preview, live tournament, or golden draft output.

**Steps**

1. Determine ordered advancers from standings: all group rank 1s in group order, then rank 2s, continuing through `advancementCount`.
2. Snapshot first bracket round match rows.
3. Compare pairings against `(0, n−1), (1, n−2), …` over the ordered advancer list.

**Expected**

- First-round slots follow `A1, B1, C1, D1, A2, …` seeding (§9.1).
- Pairings place highest seed against lowest seed, second highest against second lowest, and so on (§9.2).

---

## Match list ordering & labels

### M-01 — Tournament matches appear in deterministic order

**Preconditions**: Known small tournament seed where order is precomputed OR snapshot match labels sequence after creation.

**Steps**

1. After creation, snapshot full match list in tournament details.
2. Record ordered list of match identifiers (group match names / stage labels).

**Expected**

- Order matches spec §8.2 (interleaved groups). For regression, compare to golden ordering for a fixed fixture.

### M-02 — Bracket slot labels are human-readable

**Preconditions**: Bracket matches with unresolved slots.

**Steps**

1. Snapshot bracket section of **Tournament** tab or preview.

**Expected**

- No opaque `1D vs 2A`-style seeds.
- Labels follow §9.7 patterns (“Winner of Group A”, “Winner of {stage}”, “Loser of …”) in the app locale.

### M-03 — Preview bracket rows read-only

**Preconditions**: Create page preview showing bracket.

**Steps**

1. Snapshot a bracket match row; attempt to open edit controls that exist on editable `MatchRow` elsewhere.

**Expected**

- Preview rows do not expose completion/edit affordances reserved for real matches (read-only mode).

### M-04 — Third-and-below group rank slot labels

**Preconditions**: Bracket or preview where a slot depends on **rank ≥ 3** in a group (e.g. 3 advancers per group in large event, if product supports).

**Steps**

1. Locate slot label in snapshot.

**Expected**

- Copy matches **“{rank}. place in group {Group}”** pattern (localized) per §9.7. If configuration never surfaces rank ≥ 3, mark **N/A** and cover §9.7 via code fixture.

### M-05 — Winner vs runner-up feeder wording

**Preconditions**: Unresolved first-round bracket slots fed by group ranks 1 and 2.

**Steps**

1. Snapshot labels for adjacent feeder slots.

**Expected**

- Rank 1 feeder uses **Winner of {Group}**; rank 2 uses **Runner-up in {Group}** (localized §9.7). No anonymous “Player 1” without feeder.

---

## Match completion & slot resolution

### MC-01 — Completing group match updates standings / advancer display

**Preconditions**: `S_WITH_TOURNAMENT`; at least one incomplete group match; tester knows how match editing opens in app.

**Steps**

1. Open match editor for a group-stage tournament match (same flow as non-tournament matches per §14).
2. Set winner / complete match per UI.
3. `browser_wait_for` toast or network idle; return to session **Tournament** tab.
4. `browser_snapshot`.

**Expected**

- Standings wins/losses reflect completion; `qualifies` highlighting matches advancement count when applicable.

### MC-02 — Bracket slot fills after upstream completion

**Preconditions**: Bracket where first-round dependency is `group_rank` and group play just completed enough to resolve seed (per current implementation: may require full group completion per §10).

**Steps**

1. Complete remaining group matches per rules.
2. Snapshot bracket before and after final resolving match.

**Expected**

- Previously labeled slots show concrete players when dependencies satisfied; no manual bracket-only edit path required.

### MC-03 — Bracket `match_winner` / `match_loser` propagation

**Preconditions**: First-round bracket matches resolved; second-round slots show “Winner of …” labels.

**Steps**

1. Complete a first-round bracket match with a winner.
2. `browser_snapshot` dependent second-round match row.

**Expected**

- Winner appears in downstream slot per §9.6 / §10. For double elim, repeat once for a lower-bracket feeder that uses `match_loser` if visible in UI.

### MC-04 — Uncomplete / replan clears downstream bracket assignment

**Preconditions**: Bracket match completed; downstream slot shows winner.

**Steps**

1. Open same match editor; set status back to non-completed / clear winner (whatever “planned again” means in UI).
2. Snapshot downstream slot.

**Expected**

- Downstream player removed or reverted to feeder label (§10). Standings from **group** stage edits not covered here.

### MC-05 — Fixed-point: multi-hop resolution in one refresh

**Preconditions**: Linear chain where completing match A unlocks B unlocks C (same session).

**Steps**

1. Complete A then B in one rapid sequence **or** single action if UI batches.
2. After idle, snapshot C.

**Expected**

- If A and B both finalize in one resolution pass, C shows correct player without manual reload (§10 fixed-point, §14 same-step broadcast).

### MC-06 — Changing upstream winner overwrites downstream bracket slot

**Preconditions**: Bracket match completed; downstream slot already shows the original winner.

**Steps**

1. Reopen upstream match through the normal match editor.
2. Change winner to the other player and save as completed.
3. Snapshot downstream bracket match.

**Expected**

- Downstream bracket slot is overwritten with the new winner, not left stale (§10).
- Broadcast/read model update shows the changed slot in the same refresh as the edited match (§14, §19).

### MC-07 — Slot resolution does not rewrite group-stage match players

**Preconditions**: **Eng** primary unless UI allows player edits on tournament group matches; tournament has completed bracket progression.

**Steps**

1. Record player assignments for a group-stage tournament match.
2. Trigger slot resolution by completing, uncompleting, or editing an unrelated bracket match.
3. Reload tournament details and the underlying match view.

**Expected**

- Group-stage match player columns remain unchanged; only bracket-slot players are recomputed by slot resolution (§10).

---

## Lifecycle — qualification frozen (§4, §6.1)

### L-01 — New qualification lap after group play does not re-seed groups

**Preconditions**: `S_WITH_TOURNAMENT`; at least one **completed** group-stage tournament match; qualification track known.

**Steps**

1. Snapshot **Tournament** tab: note group membership for two participants.
2. On **Session** tab (or time entry flow), add a new **valid** lap for a participant on the qualification track **after** group play started.
3. Return to **Tournament** tab; snapshot groups.

**Expected**

- Group assignments unchanged; qualification list may update times/ranks visually but groups do not reshuffle (§4, §6.1).

---

## Track distribution (§11)

### T-01 — Multi-track per stage rotates in preview and live

**Preconditions**: Create form or tournament with a stage configured with **two** distinct tracks `T0`, `T1`.

**Steps**

1. List consecutive matches **within that stage** in order (preview and after create).
2. Read track labels / track names on those rows.

**Expected**

- Match `i` (0-based) within the stage uses configured track `i mod T` (`T` = track count) — for two tracks, pattern alternates `T0`, `T1`, `T0`, … (§11). Preview ordering matches post-create ordering for same config; order of picks in **`ComboboxMulti`** is preserved (§5.2).

### T-02 — Stage track isolation and no fallback

**Preconditions**: Create page or API fixture where one used stage has configured tracks and another used stage intentionally has no tracks.

**Steps**

1. Generate preview with tracks configured for one stage only.
2. Snapshot matches in both stages.
3. Attempt create.

**Expected**

- Matches in the configured stage use only that stage’s tracks (§11).
- Matches in the unconfigured stage show no track in preview; tracks from other stages are not used as fallback (§5.2, §11).
- Create remains blocked until every draft match has a non-null track (§13, §18).

---

## Deletion

### D-01 — Admin deletes tournament

**Preconditions**: **AdminOrMod**; `S_WITH_TOURNAMENT`; UI exposes delete (session or tournament panel — locate in app).

**Steps**

1. Trigger delete control; confirm dialog if present (`browser_handle_dialog` if needed).
2. `browser_wait_for` success indication.
3. `browser_snapshot` **Tournament** tab.

**Expected**

- Tournament UI reverts to no-tournament state; create entry visible again for admin.
- Qualification laps still visible on **Session** tab lap leaderboards (§15).

### D-02 — Delete idempotent / safe for regular user

**Preconditions**: **RegularUser**; session with or without tournament.

**Steps**

1. Attempt delete action if any visible.

**Expected**

- No delete control **or** server rejects; no partial UI state.

### D-03 — Delete idempotent (admin)

**Preconditions**: **AdminOrMod**; tournament just deleted (D-01) or session never had tournament.

**Steps**

1. Trigger delete again if control still shown, or repeat delete API/socket action via UI affordance.

**Expected**

- No error toast **or** benign no-op; session remains without active tournament (§15).

### D-04 — Non-tournament session data survives tournament delete

**Preconditions**: Session with ordinary match + qualification laps + `S_WITH_TOURNAMENT`.

**Steps**

1. Note a non-tournament match and a lap on **Session** tab.
2. Delete tournament (D-01).
3. `browser_snapshot` **Session** tab.

**Expected**

- Same non-tournament matches and time entries still visible (§15).

### D-05 — Tournament-backed matches disappear from all match surfaces after delete

**Preconditions**: `S_WITH_TOURNAMENT`; note at least one tournament match visible in tournament tab and, if available, another normal match surface.

**Steps**

1. Delete tournament (D-01).
2. Reopen **Tournament** tab, **Session** tab, and any global/session match surface where the tournament match was visible.
3. `browser_snapshot` each surface.

**Expected**

- Tournament details payload is `null`; tournament match rows are no longer visible anywhere (§15).
- Underlying match records for tournament matches are soft-deleted, while non-tournament matches remain visible.

---

## Validation & error surfaces

### V-01 — Cancelled session rejects tournament actions

**Preconditions**: **AdminOrMod**; `S_CANCELLED`.

**Steps**

1. Attempt preview/create paths for that session.

**Expected**

- Localized error toast or route block; no tournament persisted.

### V-02 — Double elimination only with 4 or 8 advancers

**Preconditions**: Create page; participant count fixture where total advancers would be 16 but double elim invalid — adjust groups/advancement so `g × a` ∉ {4, 8}.

**Steps**

1. Try to select **double** elimination in UI.

**Expected**

- Control disabled **or** selecting it snaps to valid combination (§5.1).

### V-03 — Backend error on duplicate create

**Covered by C-05**; keep for regression matrix.

### V-04 — Fewer than four confirmed participants

**Preconditions**: **AdminOrMod**; `S_SMALL` (fewer than four `yes`).

**Steps**

1. Open create flow; attempt preview and create.

**Expected**

- Localized error or disabled create; preview does not silently succeed (§18). Toasts on API attempt.

### V-05 — Blank tournament name

**Preconditions**: Create page; otherwise valid.

**Steps**

1. Clear **name**; fill other fields; try submit.

**Expected**

- Client validation blocks submit; no persistence (§5, §18).

### V-06 — Groups count out of range (server)

**Preconditions**: **Eng** or API fuzz; UI may not expose invalid `g`. If UI-only: skip.

**Steps**

1. Send preview/create with invalid `groupsCount` via intercepted request (`browser_network_request` tamper) if tooling allows.

**Expected**

- 4xx + localized toast; no draft persisted (§18).

### V-07 — Advancement violates floor(p/g)

**Preconditions**: Same as V-06; invalid `advancementCount`.

**Expected**

- Rejected (§18).

### V-08 — Total advancers not power of two

**Preconditions**: Participant count where only invalid `g×a` remain — UI should not list them; if forced by API, reject.

**Expected**

- No valid combination selectable **or** server error (§18).

### V-09 — Invalid qualification track id

**Preconditions**: Tamper preview payload with bogus track id.

**Expected**

- Localized error (§18).

### V-10 — Invalid per-stage track reference

**Preconditions**: Tamper stage track list with deleted track id.

**Expected**

- Localized error on create/preview (§18).

### V-11 — Unsupported bracket features rejected explicitly

**Preconditions**: **Eng** primary: attempt API/config that would require bronze, `loser_bronze`, or bracket reset (§18 end, §20).

**Steps**

1. If UI exposes no such path, run backend/unit test only and mark Playwright **N/A**.

**Expected**

- Explicit error — no silent degradation (§18).

### V-12 — Missing session rejects tournament actions

**Preconditions**: **AdminOrMod**; use create/preview/delete URL or API request with nonexistent session id.

**Steps**

1. Attempt preview, create, and delete against nonexistent session id.

**Expected**

- Localized not-found or validation error; no mutation and no unexpected tournament records (§18).

### V-13 — Invalid generated slot dependencies reject create

**Preconditions**: **Eng** primary: use draft/unit fixture or request tampering to produce a bracket slot dependency pointing at a nonexistent group rank or upstream match.

**Steps**

1. Submit create path with invalid generated dependency.
2. Reload session details and match lists.

**Expected**

- Create fails before persistence or rolls back completely.
- No partial tournament is visible; localized error identifies invalid tournament configuration (§18).

---

## Realtime & consistency (multi-client)

### R-01 — Second tab receives match-driven tournament updates

**Preconditions**: Two browser tabs; **AdminOrMod** completes a match while **RegularUser** (or same user) keeps session open.

**Steps**

1. Tab A: **RegularUser** on session **Tournament** tab.
2. Tab B: **AdminOrMod** completes a tournament match.
3. Tab A: `browser_wait_for` brief delay; `browser_snapshot`.

**Expected**

- Tournament details in Tab A refresh without manual reload; bracket/standings reflect change (§19). Slot resolution already applied in payload (§19).

### R-02 — Second tab sees tournament after create

**Preconditions**: Two tabs; Tab A **RegularUser** on session **Tournament** tab (empty state). Tab B **AdminOrMod** creates tournament.

**Steps**

1. Tab B: complete C-04.
2. Tab A: wait; snapshot.

**Expected**

- Tab A shows new tournament details without full reload (§19).

### R-03 — Second tab clears tournament after delete

**Preconditions**: `S_WITH_TOURNAMENT`; Tab A **RegularUser** on **Tournament** tab; Tab B **AdminOrMod**.

**Steps**

1. Tab B: delete tournament.
2. Tab A: wait; snapshot.

**Expected**

- Tab A shows no-tournament state consistent with G-03 (§19, §15).

### R-04 — Standard matches broadcast alongside tournament

**Preconditions**: **RegularUser** on **Session** tab or global matches view; **AdminOrMod** edits a tournament match result.

**Steps**

1. Note visible match list state.
2. Tab B: complete or edit tournament match.
3. Tab A: snapshot relevant list.

**Expected**

- `all matches` style refresh keeps non-tournament views consistent (§19). Adjust steps to wherever match rows appear.

### R-05 — Creation toast and deletion toast on acting client

**Preconditions**: Single tab; **AdminOrMod**.

**Steps**

1. Create tournament; observe toast.
2. Delete tournament; observe toast.

**Expected**

- Shared toast framework surfaces success and errors (§19, §18).

### R-06 — Role-aware socket traffic (spot)

**Preconditions**: **RegularUser** connected; use `browser_network_requests` or WS frame logging if MCP exposes it.

**Steps**

1. Perform admin-only action in another session or tab.
2. Inspect traffic to **RegularUser** session.

**Expected**

- No admin-only payloads delivered (§17, §19). **Eng**: if not observable in Playwright, mark N/A and cover in backend tests.

### R-07 — Realtime replacement matches initial-load details

**Preconditions**: Two tabs on the same tournament session; Tab A stays open, Tab B performs a tournament-affecting change.

**Steps**

1. Tab A: snapshot tournament details before change.
2. Tab B: create, delete, or edit a tournament match.
3. Tab A: wait for realtime update and snapshot.
4. Hard-refresh Tab A and snapshot again.

**Expected**

- Realtime-updated tournament details match the hard-refresh initial-load state for visible qualification, standings, matches, slot labels, tracks, progress summaries, and any UI-surfaced **`workloadSummary`** fields (§19, §21.6, §21.9).
- UI replaces tournament details wholesale; no stale nested fields remain from the previous state.

---

## Permissions matrix (quick checks)

| Case ID | Actor       | Action                | Expectation                                                                                    |
| ------- | ----------- | --------------------- | ---------------------------------------------------------------------------------------------- |
| P-01    | RegularUser | View tournament       | Details visible if session viewable                                                            |
| P-02    | RegularUser | Create                | Blocked (UI + server)                                                                          |
| P-03    | RegularUser | Delete                | Blocked                                                                                        |
| P-04    | AdminOrMod  | Preview/create/delete | Allowed per above scenarios                                                                    |
| P-05    | RegularUser | Complete match        | Same as normal match policy (§17); if users cannot edit matches, tournament match also blocked |

Execute P-01–P-05 by repeating navigations under each fixture account.

---

## Out of scope / negative product checks (§20)

### O-01 — No post-create structure editing

**Preconditions**: `S_WITH_TOURNAMENT`.

**Steps**

1. Search session UI for controls to change groups count, advancement, elimination type, or reseed bracket after creation.

**Expected**

- No such controls; only delete + recreate path (§20). Document if any experimental UI appears.

---

## Optional data-heavy checks (not pure Playwright)

These validate rules from §5–§9 precisely; automate outside browser or via API if available:

- **Snake assignment** (§7.1): fixed qualification order → group membership; group sizes differ by at most one.
- **Standings sort** (§8.3): fixed completed match set → rank vector and `qualifies`.
- **Advancer seeding** (§9.1): A1, B1, C1, … then A2, B2, …
- **First-round pairing** (§9.2): high vs low seed pairing order over list.
- **Double-elim topology**: graph checks for 4/8 advancers vs §9.4 narrative.
- **Valid lap / ranking** (§6.2): timed vs untimed segments, `userId` tiebreak.
- **Track rotation** (§11): `i mod T` and max imbalance ≤ 1 across a stage.
- **`workloadSummary`** (§12, §21.6): distinct tracks, qual laps per player, min–max tournament matches per player from structural format (group sizes, advancer count, elimination type, assigned track ids); same formula for preview and persisted details.
- **Unsupported configs** (§18 end): bronze / bracket-reset attempts return explicit errors.

Use existing backend specs (e.g. `tournament-draft.spec.ts`) for deterministic logic; keep Playwright focused on UI contracts and integration.

---

## Traceability index (test IDs)

| IDs         | Primary spec             |
| ----------- | ------------------------ |
| G-01–G-03   | §16 tabs, §16.3          |
| S-01–S-03   | §1, §16.1                |
| U-01–U-02   | §3, §16.2, §16.3         |
| C-01–C-17   | §5, §12–§13, §21.6–§21.7 |
| Q-01–Q-04   | §6                       |
| GR-01–GR-02 | §7–§8.1                  |
| GS-01–GS-03 | §8.3, §16.4              |
| B-01–B-04   | §9.1–§9.5                |
| M-01–M-05   | §8.2, §9.7, §21.8        |
| MC-01–MC-07 | §8.3, §10, §14           |
| L-01        | §4, §6.1                 |
| T-01–T-02   | §11                      |
| D-01–D-05   | §15                      |
| V-01–V-13   | §18                      |
| R-01–R-07   | §17–§19                  |
| P-01–P-05   | §17                      |
| O-01        | §20                      |
