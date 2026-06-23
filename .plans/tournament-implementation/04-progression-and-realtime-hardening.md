# Tournament Task 04 - Progression And Realtime Hardening

## Overview

Make tournament state reactive and resilient when normal match edits change tournament results. This task hardens slot resolution, integrates it with `MatchManager`, and broadcasts tournament details through the same loading path used by initial fetches.

## Acceptance Requirements

- Completing, editing, uncompleting, cancelling, or deleting a tournament match reruns slot resolution before clients receive updated tournament details.
- Slot resolution iterates to a fixed point and updates downstream bracket players when upstream results change.
- Only bracket slots derived from dependencies are overwritten; manually edited group-stage players are not.
- Tournament details are emitted to clients viewing that session after every durable tournament-affecting change.
- Standard `all_matches` and `all_rankings` broadcasts remain consistent with tournament details.
- Frontend listeners replace tournament details wholesale rather than patching nested state.

## Implementation Steps

### Backend Progression

- [ ] Add a `TournamentManager.afterMatchMutation(matchId)` hook.
- [ ] Have `MatchManager.onCreateMatch`, `onEditMatch`, and `onDeleteMatch` call the hook after durable writes and before broadcast when the match belongs to a tournament.
- [ ] Move tournament-related broadcasts into the command module so match editing does not know bracket rules.
- [ ] Resolve `group_rank` slots when group play is complete for the relevant group.
- [ ] Resolve `match_winner` and `match_loser` slots when upstream matches are completed and have a winner.
- [ ] Clear or overwrite downstream players when upstream results become incomplete or change winners.
- [ ] Preserve match status, track, comments, and other normal match fields during slot updates.

### Realtime Transport

- [ ] Add a server-to-client event for `tournament_details_updated`.
- [ ] Include the session id and nullable `TournamentDetails` in the payload.
- [ ] Emit after create and after every tournament match mutation.
- [ ] Keep role-aware emission in one place, even if the first implementation broadcasts only viewer-safe details.
- [ ] Keep `all_matches` broadcasts for global match surfaces.

### Frontend

- [ ] Add a listener in the tournament data hook for `tournament_details_updated`.
- [ ] Ignore events for other sessions.
- [ ] Replace the current details object wholesale when an event arrives.
- [ ] Surface reusable toasts for tournament updates only when the action was initiated by the current user.
- [ ] Verify `MatchRow` completion buttons work inside the Tournament tab without a special tournament-only flow.

### Verification

- [ ] Add `.spec.ts` coverage for fixed-point slot resolution and downstream overwrite behavior.
- [ ] Run `npm run check`.
- [ ] In two browser tabs, complete a group match and verify standings/progress update in both tabs.
- [ ] Complete all group matches, verify first bracket round resolves, then complete bracket matches and verify the final resolves.
- [ ] Change a completed upstream result and verify downstream bracket players update.
