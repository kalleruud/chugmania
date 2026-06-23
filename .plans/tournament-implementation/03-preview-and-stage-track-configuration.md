# Tournament Task 03 - Preview And Stage Track Configuration

## Overview

Replace the MVP's single tournament track with the full preview-driven create experience: per-stage ordered track configuration, debounced draft preview, workload summary, and create readiness gating.

## Acceptance Requirements

- Preview and create use the same draft pipeline.
- The create page auto-refreshes preview only when structure fields change, not when name or description changes.
- Per-stage track controls appear only for stages used by the current draft.
- Hidden stage track selections are pruned from form state.
- Create is disabled until the latest preview has loaded and every generated match has a non-null track.
- The preview uses the same `TournamentDetails` shape and `TournamentPanel` component as live tournaments.
- Preview header shows workload summary instead of name and description.

## Implementation Steps

### Shared Contracts

- [ ] Add `preview_tournament` socket request and response types.
- [ ] Extend create and preview requests with ordered `stageTracks`.
- [ ] Add stage-track and workload summary fields to `TournamentDetails`.
- [ ] Add a reusable option helper for valid groups, valid advancement counts, double-elim availability placeholders, and used stages.

### Database

- [ ] Add a `tournamentStageTracks` table with tournament id, stage, track id, and order index.
- [ ] Keep stage tracks isolated; do not introduce fallback behavior in persistence or query logic.
- [ ] Run `npm run db:gen`.
- [ ] Add the new table to `AdminManager.TABLE_MAP` and `EXCLUDED_COL_EXPORT`.

### Backend

- [ ] Implement `TournamentManager.onPreviewTournament`.
- [ ] Reuse the same validation and draft generation used by create.
- [ ] Add an in-memory draft-to-details adapter that produces synthetic ids.
- [ ] Add even track rotation by stage in the draft module.
- [ ] Allow preview details to contain null match tracks so the UI can show missing configuration.
- [ ] Reject create, but not preview, when any generated match has a null track.
- [ ] Compute `workloadSummary` from structure: distinct track count, one qualification lap per player, and min/max tournament matches per player.

### Frontend

- [ ] Extend `frontend/components/combobox.tsx` to expose a named `ComboboxMulti` without breaking existing single-select call sites.
- [ ] Use `Combobox` for qualification track and `ComboboxMulti` for each used stage.
- [ ] Add a debounced preview effect around 380 ms.
- [ ] Keep the previous preview visible while a new request is in flight.
- [ ] Guard against stale preview responses by applying only the latest request.
- [ ] Add a hidden readiness input or equivalent form validation hook for "all draft matches have tracks".
- [ ] Make the preview pane sticky on large screens with a bounded form column and flexible preview column.

### Verification

- [ ] Run `npm run check`.
- [ ] Verify preview changes after group, advancement, elimination, qualification track, or stage tracks change.
- [ ] Verify preview does not refresh for name or description edits.
- [ ] Verify create is blocked until every used stage has tracks.
- [ ] Verify track rotation is even across stages in preview and persisted tournament details.
