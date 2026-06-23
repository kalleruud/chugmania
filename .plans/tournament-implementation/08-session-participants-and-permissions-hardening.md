# Tournament Task 08 - Session, Participants, And Permissions Hardening

## Overview

Close the product gaps around the session screen and permission model after tournament creation, preview, and progression are working. This task makes the tabs behave as independent surfaces and ensures frontend visibility matches backend enforcement.

## Acceptance Requirements

- Session tab lists non-tournament matches and ordinary lap leaderboards only.
- Participants tab lists every signup response and includes a yes/maybe/no summary.
- Logged-in users can update their own RSVP from the Participants tab.
- Tournament tab shows create controls only to admins/moderators when no tournament exists.
- Backend rejects unauthorized preview, create, and delete requests even if a client calls the socket directly.
- Unauthorized realtime traffic does not expose admin-only payloads.
- Tournament-related toasts use the shared toast framework and remain reusable.

## Implementation Steps

### Session Tab

- [ ] Add a reusable helper to identify tournament-backed match ids from tournament details or tournament match rows.
- [ ] Filter tournament-backed matches out of `TrackLeaderboard` and `MatchList` for the Session tab.
- [ ] Keep ordinary lap times, including qualification laps, visible as normal lap times.
- [ ] Verify global session cards or summaries do not accidentally expose tournament-only match labels where the spec forbids them.

### Participants Tab

- [ ] Split the current `Signup` component into reusable pieces if needed: self RSVP, response summary, and grouped user list.
- [ ] Preserve existing RSVP socket behavior through `rsvp_session`.
- [ ] Show counts for yes, maybe, and no.
- [ ] Keep historical/cancelled-session disabled behavior consistent with current rules.

### Permissions

- [ ] Centralize frontend `canManageTournament` checks.
- [ ] Ensure preview, create, and delete backend handlers all call `AuthManager.checkAuth(socket, ['admin', 'moderator'])`.
- [ ] Ensure regular users can fetch/view tournament details for sessions they can already view.
- [ ] Keep role-aware broadcast filtering in the tournament manager.

### Verification

- [ ] Run `npm run check`.
- [ ] Verify admin/moderator and regular-user snapshots for all three tabs.
- [ ] Verify a regular user cannot preview, create, or delete by direct socket call.
- [ ] Re-run the known `S-01` scenario from `.plans/TOURNAMENT_FEATURE.TESTS.results.md` and confirm tournament matches no longer appear on the Session tab.
