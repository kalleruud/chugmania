# Repository Guidelines

## Project Description & Goals

This is a web app called "Chugmania", made for tracking lap times in the game Trackmania Turbo.

The most important features of the app are:

- Users can sign up and sign in, but anyone can see all data without logging in.
- Users can submit lap times in the format "01:23.45". This lap-time input is within one click
- Users can easily look up each tracks leaderboards, and each users stats and best leaderboard entries.
- When the backend does an update to the db, the change should be emitted to all clients. For example, when a lap time is submitted, it should be displayed on all clients.
- When a client receives an unexpected update from the backend, display it as a toast. For example, when someone registered a new lap time.

### Lap Time Input

Accepts the lap time, a user a track and a comment.

- The lap time is unput in 6 boxes on the format "##:##.##", like an OTP input. Inputting values should move focus to the next box. Backspase moves focus backwards, arrowkeys moves focus to the relative box. Only valid times should be accepted max value is "59:59.99", and min value is "00:00.01".
  - Allow boxes to be empty, just assume there is a "0" there. So "x1:6x:x1" (where "x" is empty) is also valid.
- Users are input by a searchable dropdown. Always default to the last input user or yourself. Users can't see this options, only moderators and admins.
- Tracks are also input by a searchable dropdown. Always default to the tracks page you're on or the last input track. If non of these exists, default to empty.

### Pages

#### Home/Dashboard Page

The homepage displays multiple sections:
- Latest registered times (Last 7 days)
- Displays "Top 10 global overall"-leaderboard using the "global ranking system", see Gamification & Stats
- Displays "Top 10 global average"-leaderboard" using the "overall ranking system", see Gamification & Stats

If logged in:
- Displays your user data and stats
- Displays the Lap Time Input component
- Displays all track cards where you have a lap-time registered.

#### Track list

- Displays all tracks as cards with top 3 lap times, amount of laps, level and type displayed as tags. Sorted by track number.
- Users can search on any of the displayed information on the card (Even on the names of the top 3 users)
- Clicking on a track card opens a full page of track data and the full leaderboards
- Track names are shown as `#05`, `#15`, `#134` (derived from track number and not stored in the database)

##### Track

- Displays the Lap Time Input component above the leaderboard
- Displays the tracks leaderboard with the best lap time from each user sorted by duration as well as their leaderboard position as a number. The leaderboard fetches 100 users at a time and fetches the next 100 when scrolling to the bottom.
- Leaderboards are searchable, indexed on player name. The search just "dims" the lap times not fitting the search. On submit, scroll to the highest result.
- On leaderboards, users can switch between displaying the gap to the lap time above or the gap to the leader. Formatted as "+1.23" (seconds and houndreths) and displayed as a tag.

#### Players

- Displays all players as cards with top 3 leaderboard positions.

### Gamification & Stats

- Each player has a **personal best** for every track, highlighted in their stats.
- A **global ranking system** exists, summing up points based on leaderboard positions. For example:
  - 1st place = 25 pts
  - 2nd place = 18 pts
  - 3rd place = 15 pts
  - 4th place = 12 pts
  - 5th place = 10 pts
  - 6th place = 8 pts
  - 7th place = 6 pts
  - 8th place = 4 pts
  - 9th place = 2 pts
  - 10th place = 1 pt
  - Rest gets nothing
  - Only the best lap for each user per track counts.
- A **overall ranking system** exists, averaging the leaderboard positions for each users lap times
  1. Take the leaderboard position of every single lap time for each user.
  1. Calculate the average positon, lower equals better
- Award **badges/achievements** for milestones, such as:
  - "Noob" (Completed 1 - 10 lap times)
  - "Contender" (Completed 10 - 50 lap times)
  - "Chugster" (Completed 50+ lap times)
  - "Fernando Chuglonso" (Completed the most lap times)
  - "Chug Leader" (Holding the best lap time on a track)
  - "Top Chugger" (Top 10 overall ranking)
  - "Chugmaniac" (Top 3 overall ranking)
  - "Max Chugstappen" (Top 1 overall ranking)
  > Display a toast on new acheivements
- Users can see **progress stats** like:
  - Number of laps completed
  - Average position per track
  - Improvement history over time as a graph (per track)

### Security

- Anonymous users can view all data on the site, but not modify anything.
- Users can create, delete and modify their own times and user details.
- Moderators can create, delete and modify anyones lap times, as well as creating, modifying and deleting custom tracks.
- Admins can do anything a moderator can, and modify any users details.

### UI & Code

The UI is clean and intuitive dark-mode made with well organized tailwind css. The design is inspired by the Formula 1 TV graphics and the [F1 Website](https://f1.com).

The code is simple and minimal, and very easily readable. Modular components are heavily utilized to avoid code duplication and keep the UI unified. For example, instead of creating a new button every time, create a reusable button component with configurable parameters and use that instead.

Refactoring is encouraged!  
Always keep AGENTS.md and README.md updated!

## Project Structure & Module Organization

- `backend/`: Node.js + TypeScript Socket.IO server. Database in `backend/database/` (Drizzle + SQLite). Runtime data in `backend/data/`. Entry at `src/server.ts`.
- `frontend/`: React + Vite app (TypeScript). Entry at `frontend/src/App.tsx`.
- `common/`: Shared TypeScript models and utilities, consumed via `@chugmania/common`.
- Place tests next to sources (e.g., `backend/src/foo.spec.ts`, `frontend/src/Bar.test.tsx`).

## Build, Test, and Development Commands

- Backend
  - `cd backend && npm install`: Install server deps.
  - `npm start`: Run dev server with `tsx` (watches `src/server.ts`).
  - `npm run check`: Type-check and verify Prettier formatting.
  - Drizzle: `npm run db:gen | db:migrate | db:push | db:studio`.
- Frontend
  - `cd frontend && npm install`: Install web app deps.
  - `npm start`: Run Vite dev server.
  - `npm run build`: Type-check and production build.
- Common
  - `cd common`: Used via `file:../common`. If linking breaks, re-run `npm install` in frontend/backend.

## Coding Style & Naming Conventions

- Formatting: Prettier (2 spaces, single quotes, no semicolons, trailing commas). Run `npm run check` in `backend/`.
- Language: TypeScript everywhere. Prefer explicit types at public boundaries.
- Files: Backend managers use `name.manager.ts`. React components/contexts use `PascalCase.tsx`.
- Imports: Use `@chugmania/common/*` in app code and `@database/*` within backend.
- Code principles: write the minimal, easy-readable solution; match existing patterns and file layout.
- Keep functions small and focused; prefer clear names over cleverness.
- Avoid unnecessary abstractions, comments, and dependencies; implement only what is needed for the task.
- Respect existing module boundaries and naming; do not restructure unrelated code.

## Testing Guidelines

- Frameworks: Prefer Vitest for unit tests and Playwright for e2e.
- Naming: `*.spec.ts` for backend/common; `*.test.tsx` for React.
- Location: Place tests alongside sources (e.g., `src/foo.spec.ts`).
- Scripts: Add `npm test` when introducing a framework; keep tests fast and focused.

## Commit & Pull Request Guidelines

- Commits: Short, imperative messages (e.g., "Add logout functionality"). Optional scope: `backend:`, `frontend:`, `common:`.
- PRs: Include summary, motivation, screenshots for UI changes, and steps to test. Link issues with `Closes #123`.
- Scope: Keep changes focused; update docs when behavior or commands change.

## Security & Configuration Tips

- Backend env: set `DB_URL` (required), `SECRET` (JWT; optional), `TOKEN_EXPIRY_H` (default `1`). Create `backend/.env` for local dev.
- SQLite files are ignored by Git; back up migrations via Drizzle commands.
