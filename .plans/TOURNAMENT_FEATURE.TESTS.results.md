# Tournament feature — Playwright MCP test results

**Run date:** 2026-05-10  
**App URL:** http://localhost:6996/  
**MCP:** `user-playwright` (snapshots under `.playwright-mcp/`)

**Data policy (Round 4+):** All tournament fixtures created **in-app** via UI (no seed script). `npm run seed:e2e` removed from `package.json`; `scripts/seed-tournament-test-data.ts` absent from repo.

---

## Round 4 — In-app create + matrix completion (2026-05-10)

**Auth:** JWT in `localStorage` key `auth`, `HS512` + `SECRET` from `.env` (same as `AuthManager`).

| Fixture                                       | Session ID                             | Notes                                                                                                                                       |
| --------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `S_MANY` / primary `S_WITH_TOURNAMENT` (CMWC) | `d61cce22-7d6e-47eb-bbad-64b7731f8042` | **MCP In-App Tournament** created via create page (2 grupper, 2 videre, enkel eliminering; stage tracks **#02 white drift**; qual **#01**). |
| `S_WITH_TOURNAMENT` (RunkeLAN)                | `aa4b322a-771a-41ee-b077-260d99d8044d` | Existing **E2E Seed Tournament** (from earlier DB state).                                                                                   |
| `S_CANCELLED`                                 | `591af1c8-de23-41db-8957-8b6f38443f4f` | **Guttapractice**                                                                                                                           |
| `S_SMALL`                                     | `62c8d793-5581-4e9d-b2fd-1b55c8464c60` | Unchanged                                                                                                                                   |

| ID        | Result            | Notes                                                                                                                                                                                                                                                                         |
| --------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C-04**  | **Pass**          | Admin filled form, **Opprett turnering** → redirect `…/sessions/d61cce22…`, toast **Turnering opprettet**; `tournaments` row `c1a94341-…` / **MCP In-App Tournament**.                                                                                                        |
| **C-10**  | **Pass**          | After full navigation reload, **Turnering** tab header still shows description **Created via Playwright MCP for E2E matrix.**                                                                                                                                                 |
| **C-17**  | **Pass**          | Live panel: **MCP In-App Tournament** + description + progress (**Matcher** / **Gruppespill** lines).                                                                                                                                                                         |
| **U-02**  | **Pass**          | Same snapshot: progress summaries visible.                                                                                                                                                                                                                                    |
| **P-01**  | **Pass**          | Regular user (Axel): **Turnering** shows full tournament content; no **Slett turnering**.                                                                                                                                                                                     |
| **Q-01**  | **Pass**          | Qualification rows use **Venter** pattern; **Interval** / **Leader** toggle present.                                                                                                                                                                                          |
| **Q-02**  | **Pass**          | After create, all qualification rows pending (no error state).                                                                                                                                                                                                                |
| **GR-01** | **Pass**          | **Gruppespill A** / **Gruppespill B** headings in live + preview path exercised during create.                                                                                                                                                                                |
| **GS-01** | **Pass**          | Distinct standings blocks per group.                                                                                                                                                                                                                                          |
| **GS-02** | **Pass**          | Before completions: ordered ranks with **0–0** (no matches done yet in that snapshot); after MC-01, **1–0✓** etc.                                                                                                                                                             |
| **B-02**  | **Pass**          | Single elim: bracket shows **Semifinale** / **Finale**, no lower-bracket section.                                                                                                                                                                                             |
| **M-02**  | **Pass**          | Slot labels **Vinner av gruppe A**, **2. plass i gruppe B**, **Vinner av Semifinale 1** (human-readable).                                                                                                                                                                     |
| **M-05**  | **Pass**          | **Vinner**-style group feeds + ordinal semifinals observed (Norwegian copy).                                                                                                                                                                                                  |
| **MC-01** | **Pass**          | Admin clicked **KRI** on first planned group match; **Turnering** standings **1. KRI** **1–0✓**; header **Matcher: 1 / 84 ferdig** → later **2 / 84** after second completion.                                                                                                |
| **R-01**  | **Pass**          | Tab A user **Turnering** showed **Matcher: 1 / 84**; tab B admin completed second match; tab A moved to **2 / 84** without manual reload.                                                                                                                                     |
| **V-01**  | **Pass**          | `/sessions/591af1c8…/tournament/new` → **Session er avlyst.** + **Tilbake** (no create form).                                                                                                                                                                                 |
| **O-01**  | **Pass**          | Live **Turnering** panel: no **Antall grupper** / elimination / reseed controls (structure locked post-create).                                                                                                                                                               |
| **C-05**  | **Partial / gap** | Deep link `/sessions/aa4b322a…/tournament/new` with existing tournament: **preview_tournament** fails server-side (`alreadyExists`); UI stuck **Oppdaterer forhåndsvisning…**, submit stays disabled — **no duplicate-create toast** and no client handling of preview error. |
| **S-01**  | **Fail (spec)**   | **Session** tab **Matcher** on track **#75 green stadium** lists many **Gruppespill** tournament matches — violates §16.1 expectation that tournament-only matches stay off non-tournament list (or product interprets list differently).                                     |
| **S-03**  | **N/A**           | `/sessions` list snapshot had **no** per-match **Gruppespill** copy for CMWC; global match surface not proven.                                                                                                                                                                |
| **V-05**  | **Not run**       | No session with **≥4 ja** and **no** active tournament left after Round 4 without deleting data; blank-name submit not re-run.                                                                                                                                                |
| **R-02**  | **Not run**       | Would require user tab empty **before** create on same session (ordering not exercised this round).                                                                                                                                                                           |

**Eng / not exercised this round:** C-08, C-09, C-11, C-13, C-15, MC-02–MC-07, L-01, T-01–T-02, B-01 (double elim), B-03, B-04, GR-02 (count proof), GS-03 (qualifies badge progression), D-02–D-05 (post-create delete suite), R-04–R-07, P-05, U-01, V-06–V-13.

---

## Round 3 — Reference only (prior seed-based delete)

| ID       | Result   | Notes                                                           |
| -------- | -------- | --------------------------------------------------------------- |
| **D-01** | **Pass** | **Slett turnering** → **Sikker?**; toast **Turnering slettet**. |
| **R-03** | **Pass** | Regular tab cleared after admin delete.                         |
| **P-04** | **Pass** | Admin delete path OK.                                           |

---

## Environment & fixtures (summary)

| Role        | User (DB)                                           |
| ----------- | --------------------------------------------------- |
| AdminOrMod  | Ole Kallerud `eb0aeea8-5acb-4ed8-9297-683ae6714850` |
| RegularUser | Axel Ericson `57723541-3f15-48c9-8c11-22b04b1735fd` |

## Code fixes (historical)

1. **`SessionPage.tsx`** — hooks / `sessions?.find` guard.
2. **`CreateTournamentPage.tsx`** — loading guards, cancelled session copy.
3. **`tournament.manager.ts`** — `database.transaction(fn)()` so creates/deletes commit.

## Console / product issues

- **React:** `setSelected` forwarded to DOM from **Combobox** (create page).
- **C-05:** Preview error when tournament exists → loading UX stuck; should toast and/or redirect.
- **S-01:** Tournament group matches visible on **Session** tab match lists — spec mismatch or intentional; track **#75** example in Round 4 snapshot.

---

## Results by test ID (rolled-up)

Legend: **Pass** / **Fail** / **Partial** / **Blocked** / **Not run** / **N/A** / **Eng**

| ID                                                                 | Result                               | Notes                                                     |
| ------------------------------------------------------------------ | ------------------------------------ | --------------------------------------------------------- |
| **G-01**–**G-03**                                                  | **Pass**                             | Prior + Round 4 consistent.                               |
| **S-01**                                                           | **Fail**                             | Tournament matches on Session tab matcher list (Round 4). |
| **S-02**                                                           | **Partial**                          | Leaderboards load; shallow check only.                    |
| **S-03**                                                           | **N/A**                              | No global match row found on `/sessions` list.            |
| **U-01**                                                           | **Not run**                          |                                                           |
| **U-02**                                                           | **Pass**                             | Round 4.                                                  |
| **C-01**–**C-03**, **C-06**–**C-07**, **C-12**, **C-14**, **C-16** | **Pass** / **Partial**               | As in earlier runs; C-12 partial.                         |
| **C-04**                                                           | **Pass**                             | Round 4 in-app create.                                    |
| **C-05**                                                           | **Partial**                          | Preview blocked; no duplicate-submit toast.               |
| **C-08**–**C-11**, **C-13**                                        | **Not run**                          |                                                           |
| **C-15**                                                           | **Eng**                              |                                                           |
| **C-17**                                                           | **Pass**                             | Round 4.                                                  |
| **C-10**                                                           | **Pass**                             | Round 4 reload.                                           |
| **Q-01**–**Q-02**                                                  | **Pass**                             | Round 4.                                                  |
| **Q-03**–**Q-04**                                                  | **Not run** / **Eng**                |                                                           |
| **GR-01**                                                          | **Pass**                             | Round 4.                                                  |
| **GR-02**                                                          | **Not run**                          |                                                           |
| **GS-01**–**GS-02**                                                | **Pass**                             | Round 4.                                                  |
| **GS-03**                                                          | **Not run**                          |                                                           |
| **B-01**                                                           | **Not run**                          |                                                           |
| **B-02**                                                           | **Pass**                             | Round 4 single elim shape.                                |
| **B-03**–**B-04**                                                  | **Not run**                          |                                                           |
| **M-01**–**M-04**                                                  | **Not run** / **Partial**            | Ordering not golden-checked.                              |
| **M-02**, **M-05**                                                 | **Pass**                             | Round 4.                                                  |
| **M-03**                                                           | **Not run**                          |                                                           |
| **MC-01**                                                          | **Pass**                             | Round 4.                                                  |
| **MC-02**–**MC-07**                                                | **Not run**                          |                                                           |
| **L-01**                                                           | **Not run**                          |                                                           |
| **T-01**–**T-02**                                                  | **Not run**                          |                                                           |
| **D-01**                                                           | **Pass**                             | Round 3.                                                  |
| **D-02**–**D-05**                                                  | **Not run**                          | Post-create delete not re-run Round 4.                    |
| **V-01**                                                           | **Pass**                             | Round 4 cancelled session.                                |
| **V-02**                                                           | **Partial**                          | C-07 overlap.                                             |
| **V-04**                                                           | **Pass**                             | Prior `S_SMALL`.                                          |
| **V-05**                                                           | **Not run**                          |                                                           |
| **V-06**–**V-13**                                                  | **Eng** / **Not run**                |                                                           |
| **R-01**                                                           | **Pass**                             | Round 4 two-tab match count.                              |
| **R-02**–**R-03**                                                  | **R-03 Pass** (R3); **R-02 Not run** |                                                           |
| **R-04**–**R-07**                                                  | **Not run**                          |                                                           |
| **P-01**–**P-04**                                                  | **Pass**                             | P-01 Round 4; P-02/P-03 prior; P-04 R3.                   |
| **P-05**                                                           | **Not run**                          |                                                           |
| **O-01**                                                           | **Pass**                             | Round 4.                                                  |

---

## Summary

- **Round 4** proves **end-to-end create (C-04)** without seed script; DB + UI aligned after `transaction()` fix.
- **Realtime match updates (R-01)** and **MC-01** verified with two browser tabs.
- **Gaps:** **C-05** preview error UX; **S-01** possible spec/product mismatch on Session tab match list; large bracket suites (**MC-02+**, **B-01**, **T-\*** , **L-01**) still **Not run**.
