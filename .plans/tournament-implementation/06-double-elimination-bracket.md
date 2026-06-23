# Tournament Task 06 - Double-Elimination Bracket

## Overview

Add double elimination as a focused bracket-generation and progression increment after the single-elimination pipeline is already stable. This task keeps the same contracts and read model while adding lower-bracket dependencies, lower-bracket ordering, stage naming, and grand final support.

## Acceptance Requirements

- Double elimination is offered only when total advancers is exactly 4 or 8.
- Double-elim drafts generate upper bracket, lower bracket, and grand final matches with structured dependencies.
- Global match order follows dependency waves: upper round, newly available lower round, next upper round, and so on.
- Stage names are derived from rounds remaining and do not create duplicate "final" stages.
- Slot labels for loser dependencies are human-readable and derived from structured dependencies.
- Slot resolution supports both winners and losers from upstream matches.
- Unsupported bracket reset matches are rejected and not silently generated.

## Implementation Steps

### Shared Rules

- [ ] Extend valid configuration helpers so the double-elim option is disabled when no valid 4- or 8-advancer setup exists.
- [ ] Snap group and advancement selections to valid values when switching elimination type.
- [ ] Add double-elim stage keys to used-stage calculation for preview and create.

### Draft Generation

- [ ] Add lower-bracket generation for 4 advancers.
- [ ] Add lower-bracket generation for 8 advancers.
- [ ] Add grand-final generation fed by the upper-final winner and lower-final winner.
- [ ] Add `match_loser` dependencies for lower-bracket slots.
- [ ] Apply stage naming based on upper-bracket rounds remaining.
- [ ] Apply double-elim global match ordering exactly as specified.
- [ ] Keep per-stage track rotation isolated for lower-bracket and grand-final stages.

### Query And Labels

- [ ] Extend match labels so stage ordinals are stable within each bracket and omitted for single-match stages.
- [ ] Extend slot labels for `match_loser` dependencies.
- [ ] Verify preview and persisted details produce identical labels and order.

### Frontend

- [ ] Add elimination type selection to the create form.
- [ ] Hide double elimination when invalid for the participant count.
- [ ] Render upper, lower, and grand-final match sections from API-provided metadata without deriving bracket structure in React.

### Verification

- [ ] Add golden `.spec.ts` coverage for 4-advancer and 8-advancer double-elim drafts.
- [ ] Add `.spec.ts` coverage for lower-bracket slot resolution.
- [ ] Run `npm run check`.
- [ ] Create a double-elim tournament and verify lower-bracket waves appear in the expected order.
- [ ] Complete upper matches and verify losers feed lower-bracket slots.
