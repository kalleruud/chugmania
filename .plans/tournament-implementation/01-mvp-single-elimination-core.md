# Tournament Task 01 - MVP Single-Elimination Core

## Overview

Build the smallest backend slice that can create, persist, query, and progress a single-elimination tournament for one session. This establishes the shared contracts, storage, draft pipeline, read model, and command module that every later task depends on.

## Acceptance Requirements

- Admins and moderators can create one active single-elimination tournament for a non-cancelled session with at least 4 confirmed `yes` signups.
- The MVP supports one qualification track, one tournament match track used for all generated matches, valid group count, and valid advancement count.
- The backend exposes one canonical `TournamentDetails` shape used by fetches, create responses, and future realtime broadcasts.
- Generated group assignments, group matches, standings, bracket matches, slot dependencies, and slot labels are deterministic.
- Tournament matches are backed by normal `matches` rows so existing match editing can complete them.
- Single-elimination bracket slots resolve from group standings and upstream match winners through one fixed-point resolver.
- Preview, double elimination, per-stage tracks, deletion, and advanced UI polish stay out of this MVP task.

## Implementation Steps

### Shared Contracts

- [ ] Add `common/models/tournament.ts` with request and response types for create, fetch/details, participant ranking, groups, standings, tournament matches, slot dependencies, slot labels, progress summaries, and workload summary placeholders.
- [ ] Add socket events in `common/models/socket.io.ts` for `create_tournament` and `get_tournament_details`.
- [ ] Keep validation helpers explicit and narrow; avoid `any` in request guards.
- [ ] Add localized labels and errors in `frontend/lib/locales.ts` even though the first task is backend-heavy.

### Database

- [ ] Extend `backend/database/schema.ts` only where the existing tournament tables are missing required MVP data: `tournaments.qualificationTrack`, `tournament_matches.sortOrder`, and any stage/dependency columns needed to avoid string parsing.
- [ ] Reuse the existing `tournaments`, `groups`, `groupPlayers`, and `tournamentMatches` tables where possible.
- [ ] Run `npm run db:gen` after schema edits.
- [ ] Update `AdminManager.TABLE_MAP` and `EXCLUDED_COL_EXPORT` for every new tournament table added in this task.

### Backend Modules

- [ ] Add `backend/src/managers/tournament.manager.ts` as the only command surface for create, details fetch, and match-progression hooks.
- [ ] Add pure helpers near the manager or in a focused `backend/src/managers/tournament/` folder for qualification ranking, draft generation, standings, persistence, query shaping, and slot resolution.
- [ ] Implement participant lookup from confirmed session signups only.
- [ ] Implement qualification ranking from best valid lap on the qualification track, falling back to global ranking for participants without a lap.
- [ ] Implement snake group assignment and group names `A`, `B`, `C`, etc.
- [ ] Implement round-robin group match generation with deterministic ordering.
- [ ] Implement single-elimination bracket generation for power-of-two advancer counts.
- [ ] Represent first-round slots as `group_rank` dependencies and later slots as `match_winner` dependencies.
- [ ] Persist the tournament atomically with its groups, group players, tournament match records, and backing `matches`.
- [ ] Implement `getTournamentDetails(sessionId)` as the single read model adapter over persisted rows.
- [ ] Implement standings from completed group matches: wins desc, losses asc, qualification rank asc.
- [ ] Implement fixed-point slot resolution for single elimination and call it once after creation.
- [ ] Register tournament socket handlers in `backend/src/server.ts`.

### Validation

- [ ] Reject cancelled or missing sessions.
- [ ] Reject unauthorized actors.
- [ ] Reject sessions with fewer than 4 confirmed participants.
- [ ] Reject invalid group count, advancement count, and total advancer count.
- [ ] Reject duplicate active tournaments for the same session.
- [ ] Reject missing or unknown qualification/tournament tracks.
- [ ] Return localized error messages through the existing `{ success: false, message }` socket pattern.

### Verification

- [ ] Add focused `.spec.ts` coverage for qualification ranking, snake groups, round-robin generation, standings, single-elim bracket generation, and slot label generation.
- [ ] Run `npm run db:gen` if schema changed.
- [ ] Run `npm run check`.
- [ ] Manually create a tournament through a socket call or temporary harness and verify persisted rows plus `TournamentDetails`.
