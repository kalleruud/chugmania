# Tournament domain

- **Tournament**: competition attached to one session; ordinary matches carry its results.
- **Participant**: confirmed session player admitted to the tournament. Membership persists after play starts.
- **Seeding**: rating order supplies initial group distribution; creation locks group membership and the roster structure.
- **Head-to-head tie**: equal records are ranked by their decided direct match in the current round. A missing result or circular multi-player tie remains unresolved; dependent group-rank slots return null and block progression. Ratings seed groups but never break result ties.
- **Tournament draft**: the generated structure before persistence. Preview and creation call the same generator. Saved tournaments are never regenerated after signup or rating changes.
- **Slot dependency**: a player, group rank, match winner, or match loser supplying one side of a fixture.
- **Manual slot override**: an admin or moderator changes either bracket player to a tournament participant. The choice persists alongside its original dependency; clearing restores automatic resolution. Planned downstream matches follow corrections, while decided downstream matches remain protected.
- **Tournament details**: the canonical read model used by preview, fetch, and realtime updates.
- **Not ready**: a pre-start roster no longer supports its configuration; play is blocked until it becomes valid.
- **Admission closure**: creation closes entry to the tournament; subsequent session signups do not change its groups.
