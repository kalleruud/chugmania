# Tournament Implementation Build Order

## Overview

Build the tournament feature as vertical slices. The first two tasks are the minimal MVP: a single-elimination tournament can be created, viewed, and played from the session screen. Later tasks deepen preview, progression, deletion, double elimination, polish, and verification.

## Recommended Order

1. `01-mvp-single-elimination-core.md`
2. `02-mvp-session-ui.md`
3. `04-progression-and-realtime-hardening.md`
4. `03-preview-and-stage-track-configuration.md`
5. `05-deletion-and-admin-data.md`
6. `07-qualification-and-standings-polish.md`
7. `06-double-elimination-bracket.md`
8. `08-session-participants-and-permissions-hardening.md`
9. `09-e2e-regression-and-release-hardening.md`

## Why This Order

- Tasks 01 and 02 create the MVP: backend core first, then the smallest usable UI.
- Task 04 comes before the fuller preview because a playable tournament needs reliable progression and reactive details.
- Task 03 then improves creation safely because it reuses the draft and details seams already exercised by the MVP.
- Task 05 adds cleanup and admin data handling before the feature grows more complex.
- Task 07 tightens qualification and standings before double elimination depends on the same ranking and slot-label policies.
- Task 06 adds the most complex bracket behavior after the single-elim pipeline is stable.
- Task 08 closes product and permission gaps once all major surfaces exist.
- Task 09 is last because it validates the entire completed behavior and updates the existing test-results document.

## MVP Boundary

The MVP is complete after tasks 01, 02, and 04:

- Admin/moderator can create a single-elimination tournament.
- Users can view it on the Tournament tab.
- Group and bracket matches are ordinary matches.
- Completing matches updates standings, bracket slots, and connected clients.

Preview, per-stage track configuration, double elimination, deletion, and advanced qualification display are deliberately deferred.

## Dependency Notes

- Any schema change must be followed by `npm run db:gen`.
- Any new tournament table must be added to `AdminManager.TABLE_MAP` and `EXCLUDED_COL_EXPORT`.
- Every task should finish with `npm run check`.
- If a task touches frontend layout, run the app with `npm run dev` and inspect the relevant session screens.
- If a task touches bracket generation or progression, add or update colocated `.spec.ts` files next to the source.
