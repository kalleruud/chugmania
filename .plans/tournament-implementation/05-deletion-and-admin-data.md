# Tournament Task 05 - Deletion And Admin Data

## Overview

Add the lifecycle cleanup and data-management pieces around tournaments: idempotent soft deletion, duplicate-create handling, CSV import/export coverage, and user-facing error states for existing tournaments.

## Acceptance Requirements

- Admins and moderators can delete an active tournament from the session Tournament tab.
- Deletion soft-deletes the tournament, stage tracks, groups, group players, tournament match records, and backing match records.
- Deleting when no active tournament exists is a successful no-op.
- After delete, tournament details for the session become `null` and connected clients update.
- A create page opened for a session that already has a tournament shows a useful blocked state instead of a stuck preview.
- Tournament tables are included in CSV import/export.

## Implementation Steps

### Backend

- [ ] Add `delete_tournament` request and response types.
- [ ] Implement `TournamentManager.onDeleteTournament`.
- [ ] Validate session existence, non-cancelled status, and admin/moderator role.
- [ ] Look up the active tournament for the session and return success immediately if none exists.
- [ ] Soft-delete dependent rows in a transaction.
- [ ] Soft-delete underlying tournament-backed `matches` rows, not ordinary session matches.
- [ ] Broadcast nullable tournament details after deletion.
- [ ] Broadcast `all_matches` and `all_rankings` after deletion when backing matches changed.

### Admin CSV

- [ ] Add every tournament-related table to `AdminManager.TABLE_MAP`.
- [ ] Add export exclusion sets for the new tables.
- [ ] Verify import order handles dependencies or document the required CSV import order in admin copy.

### Frontend

- [ ] Add a destructive delete action to `TournamentPanel` only for admin/moderator users.
- [ ] Use `ConfirmationButton` for the delete action.
- [ ] Show success and error toasts through the shared toast framework.
- [ ] Update the create page to detect an existing tournament before starting preview.
- [ ] Redirect back to the Tournament tab or show a clear blocked state when a duplicate tournament exists.

### Verification

- [ ] Run `npm run check`.
- [ ] Delete a tournament as admin/moderator and verify the Tournament tab returns to the create empty state.
- [ ] Verify a regular user cannot see or call delete successfully.
- [ ] Verify non-tournament matches and qualification time entries remain visible after deletion.
- [ ] Export and import tournament tables through the admin CSV flow in a disposable database.
