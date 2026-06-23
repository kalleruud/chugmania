# Tournament Task 07 - Qualification And Standings Polish

## Overview

Finish the qualification and standings behavior so the tournament read model carries all ranking information needed by the UI and future rules. This task tightens the tiebreak policy, pending qualification rows, freeze behavior, and standings display.

## Acceptance Requirements

- Qualification rows distinguish timed participants from pending participants.
- Timed rows use the existing `TimeEntryRow` display behavior, including gap toggle support.
- Pending rows show no position number and are distinct from DNF rows.
- Qualification rank is the single tiebreaker for standings and advancer ordering.
- Once group play starts, qualification rank used by existing groups is stable.
- Group standings are deterministic before, during, and after group play.
- Standings blocks are one column on small screens and two columns from `xl` upward.

## Implementation Steps

### Backend Ranking

- [ ] Confirm valid qualification laps exclude deleted rows and zero-duration entries.
- [ ] Sort timed participants by best valid lap duration, then user id.
- [ ] Sort pending participants by global ranking ascending, total rating ascending, then user id.
- [ ] Add a persisted or derived freeze strategy so group assignment and tournament tiebreaks do not reseed after group play starts.
- [ ] Keep ranking policy in the standings or qualification module only.

### Read Model

- [ ] Include enough fields for `TimeEntryRow` to render timed qualification rows.
- [ ] Include a pending-row marker for participants without a qualifying lap.
- [ ] Include qualification rank for every participant in groups and standings.
- [ ] Include `qualifies` on each standing row based on `advancementCount`.

### Frontend

- [ ] Reuse `TimeEntryRow` for timed qualification rows.
- [ ] Add a small pending row component that aligns with `TimeEntryRow`.
- [ ] Add gap-to-leader and gap-to-previous toggle support in the qualification list.
- [ ] Render group standings in a responsive grid that switches to two columns at `xl`.
- [ ] Avoid deriving tiebreaks or qualification state in React.

### Verification

- [ ] Add `.spec.ts` coverage for timed and pending qualification sorting.
- [ ] Add `.spec.ts` coverage for standings tiebreaks and `qualifies`.
- [ ] Run `npm run check`.
- [ ] Verify a tournament can be created before any qualification laps exist.
- [ ] Add a later qualification lap and verify existing group assignment does not change.
