# Tournament domain

- **Tournament**: competition attached to one session; ordinary matches carry its results.
- **Participant**: confirmed session player admitted to the tournament. Membership persists after play starts.
- **Seeding**: rating order supplies initial group distribution; the first group decision freezes the roster structure.
- **Tie-break lap**: requested only after group play or an elimination round settles. Equal win/loss ratios require lap times, including eliminated players. A completed time can resolve later ties; equal times require repeat attempts.
- **Group lap snapshot**: the participant duration preserves settled group ordering; the source entry supplies the latest attempt for later placement ties. Later attempts cannot change settled group seeds.
- **Tournament draft**: the generated structure before persistence. Preview, creation, and pre-start regeneration call the same generator.
- **Slot dependency**: a player, group rank, match winner, or match loser supplying one side of a fixture.
- **Tournament details**: the canonical read model used by preview, fetch, and realtime updates.
- **Not ready**: a pre-start roster no longer supports its configuration; play is blocked until it becomes valid.
- **Admission closure**: group play has first completed; new signups no longer enter this tournament.
