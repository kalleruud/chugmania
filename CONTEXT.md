# Tournament domain

- **Tournament**: competition attached to one session; ordinary matches carry its results.
- **Participant**: confirmed session player admitted to the tournament. Membership persists after play starts.
- **Qualification snapshot**: saved best valid lap, source entry, and fallback rating, frozen at the first group decision.
- **Tournament draft**: the generated structure before persistence. Preview, creation, and pre-start regeneration call the same generator.
- **Slot dependency**: a player, group rank, match winner, or match loser supplying one side of a fixture.
- **Tournament details**: the canonical read model used by preview, fetch, and realtime updates.
- **Not ready**: a pre-start roster no longer supports its configuration; play is blocked until it becomes valid.
- **Admission closure**: group play has first completed; new signups no longer enter this tournament.
