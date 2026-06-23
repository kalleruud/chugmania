# Tournament Task 09 - E2E Regression And Release Hardening

## Overview

Turn the full specification into a repeatable verification suite and close known gaps from prior Playwright runs. This is the release-hardening task after the feature slices are implemented.

## Acceptance Requirements

- Existing known gaps are either fixed or explicitly reclassified with product-owner agreement.
- Pure tournament rules have colocated `.spec.ts` coverage.
- Playwright MCP scenarios in `.plans/TOURNAMENT_FEATURE.TESTS.md` have fresh run notes.
- `npm run check` and `npm run build` pass.
- Manual fixture creation does not rely on removed seed scripts.

## Implementation Steps

### Rule-Level Tests

- [ ] Add or complete specs for draft generation: snake groups, group match ordering, single-elim bracket, double-elim bracket, stage naming, and track rotation.
- [ ] Add or complete specs for qualification ranking and standings.
- [ ] Add or complete specs for fixed-point slot resolution, including winner changes and uncompleted upstream matches.
- [ ] Add or complete specs for workload summary math.

### Integration Verification

- [ ] Verify socket create, preview, details, delete, and match-progression flows with a disposable database.
- [ ] Verify CSV export/import for tournament tables.
- [ ] Verify duplicate-create UX does not leave preview permanently loading.
- [ ] Verify session-tab filtering for tournament matches.

### Playwright MCP Matrix

- [ ] Re-run global smoke scenarios `G-01` through `G-03`.
- [ ] Re-run create, preview, validation, and permission scenarios.
- [ ] Re-run qualification, groups, standings, bracket, and track distribution scenarios.
- [ ] Re-run match-completion and realtime scenarios with two browser tabs.
- [ ] Re-run delete scenarios.
- [ ] Update `.plans/TOURNAMENT_FEATURE.TESTS.results.md` with fresh fixture ids, pass/fail notes, and remaining risks.

### Release Checks

- [ ] Run `npm run check`.
- [ ] Run `npm run build`.
- [ ] Confirm no schema changes are missing generated Drizzle migrations.
- [ ] Confirm no unrelated generated artifacts or fixture data are included in the final diff.
