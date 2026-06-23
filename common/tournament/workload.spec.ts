import assert from 'node:assert/strict'
import test from 'node:test'
import { computeTournamentWorkloadSummary } from './workload'

test('distinct tracks include qualification and match tracks', () => {
  const w = computeTournamentWorkloadSummary({
    qualificationTrackId: 'q',
    matchTrackIds: ['a', 'b', 'a', null],
    groups: [{ memberUserIds: ['u1', 'u2', 'u3', 'u4'] }],
    groupsCount: 1,
    advancementCount: 4,
    eliminationType: 'single',
  })
  assert.equal(w.distinctTrackCount, 3)
})

test('eight players two groups of four: group matches 3 each; single elim adds 3 bracket max', () => {
  const w = computeTournamentWorkloadSummary({
    qualificationTrackId: 'q',
    matchTrackIds: [],
    groups: [
      { memberUserIds: ['a', 'b', 'c', 'd'] },
      { memberUserIds: ['e', 'f', 'g', 'h'] },
    ],
    groupsCount: 2,
    advancementCount: 4,
    eliminationType: 'single',
  })
  assert.equal(w.tournamentMatchesPerPlayer.min, 3)
  assert.equal(w.tournamentMatchesPerPlayer.max, 6)
  assert.deepEqual(w.qualificationLapsPerPlayer, { min: 1, max: 1 })
})

test('double elim eight advancers uses larger bracket cap than single', () => {
  const single = computeTournamentWorkloadSummary({
    qualificationTrackId: 'q',
    matchTrackIds: [],
    groups: [
      { memberUserIds: ['a', 'b', 'c', 'd'] },
      { memberUserIds: ['e', 'f', 'g', 'h'] },
    ],
    groupsCount: 2,
    advancementCount: 4,
    eliminationType: 'single',
  })
  const dbl = computeTournamentWorkloadSummary({
    qualificationTrackId: 'q',
    matchTrackIds: [],
    groups: [
      { memberUserIds: ['a', 'b', 'c', 'd'] },
      { memberUserIds: ['e', 'f', 'g', 'h'] },
    ],
    groupsCount: 2,
    advancementCount: 4,
    eliminationType: 'double',
  })
  assert.ok(
    dbl.tournamentMatchesPerPlayer.max > single.tournamentMatchesPerPlayer.max
  )
})
