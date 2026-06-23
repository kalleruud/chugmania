# Tournament Task 02 - MVP Session UI

## Overview

Expose the single-elimination MVP in the app: a session page with Session, Participants, and Tournament tabs, a simple tournament create flow for admins/moderators, and a reusable tournament details panel that renders the backend read model directly.

## Acceptance Requirements

- Session detail pages render three tabs: Session, Participants, and Tournament.
- Admins and moderators can open a dedicated create page from the Tournament tab when no tournament exists.
- Regular users can view existing tournament details but cannot see create controls.
- The MVP create form supports name, description, qualification track, tournament match track, groups count, and advancement count.
- The tournament panel renders qualification rows, group standings, group matches, bracket matches, slot labels, and progress summaries from `TournamentDetails`.
- Tournament match rows reuse `MatchRow`; unresolved bracket rows are read-only and show human slot labels.
- The Session tab excludes tournament matches from ordinary match lists.

## Implementation Steps

### Routing And Data Loading

- [ ] Add a route for `/sessions/:id/tournament/new` in `frontend/App.tsx`.
- [ ] Add a small tournament data hook that calls `get_tournament_details` for the current session and stores the returned details locally.
- [ ] Parse timestamp fields in tournament details consistently with `DataContext.parseDates`.
- [ ] Reuse the same load function after create and after future realtime events.

### Session Page Tabs

- [ ] Replace the current single-column session detail layout in `frontend/app/pages/SessionPage.tsx` with `Tabs` from `frontend/components/ui/tabs.tsx`.
- [ ] Move existing leaderboards and non-tournament matches into the Session tab.
- [ ] Move the existing signup UI into the Participants tab without changing RSVP behavior.
- [ ] Add the Tournament tab with role-aware empty states.
- [ ] Filter tournament-backed matches out of `TrackLeaderboard` or `MatchList` when rendering the Session tab.

### Create Page

- [ ] Add `frontend/app/pages/CreateTournamentPage.tsx`.
- [ ] Use `Combobox` for the qualification track and tournament match track.
- [ ] Use `NativeSelect` for numeric group and advancement options.
- [ ] Compute valid group/advancement options from current confirmed participant count.
- [ ] Submit `create_tournament` and redirect back to `/sessions/:id` on success.
- [ ] Surface create success and backend errors through the shared toast framework.

### Tournament View

- [ ] Add `frontend/components/tournament/TournamentPanel.tsx`.
- [ ] Add small child components only where they keep rendering readable: qualification list, standings grid, and match section.
- [ ] Render standings as one block per group.
- [ ] Render group matches and bracket matches in the deterministic order supplied by the API.
- [ ] Reuse `MatchRow` for real persisted matches.
- [ ] Add a read-only unresolved row wrapper if `MatchRow` cannot render synthetic slot labels directly.
- [ ] Keep the view rule-free: no ranking, seeding, or slot dependency logic in React.

### Permissions And Copy

- [ ] Mirror backend roles for create visibility.
- [ ] Add concise Norwegian copy for empty tournament states, create labels, validation errors, and progress labels.
- [ ] Make cancelled sessions show a clear blocked state on the create page.

### Verification

- [ ] Run `npm run check`.
- [ ] Start `npm run dev` and verify the session page tabs at `http://localhost:6996`.
- [ ] Create a single-elim tournament as admin/moderator.
- [ ] Verify a regular user can view details but cannot create.
- [ ] Verify tournament matches do not appear in the Session tab match lists.
