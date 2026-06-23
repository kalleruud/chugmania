import assert from 'node:assert/strict'
import test from 'node:test'
import { generateTournamentDraft } from './tournament-draft'

function userIds(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `u${i}`)
}

function rankMap(ids: string[]): Map<string, number> {
  return new Map(ids.map((id, i) => [id, i + 1]))
}

test('snake assigns eight participants into two groups of four', () => {
  const ordered = userIds(8)
  let k = 0
  const d = generateTournamentDraft({
    orderedParticipantIds: ordered,
    qualificationRank: rankMap(ordered),
    groupsCount: 2,
    advancementCount: 4,
    eliminationType: 'single',
    stageTracks: {},
    matchKeyFactory: hint => `${hint}-${k++}`,
    userLabel: id => id,
  })
  assert.equal(d.groups.length, 2)
  const a = new Set(d.groups[0].memberUserIds)
  const b = new Set(d.groups[1].memberUserIds)
  assert.deepEqual(a, new Set(['u0', 'u3', 'u4', 'u7']))
  assert.deepEqual(b, new Set(['u1', 'u2', 'u5', 'u6']))
})

test('single elimination eight advancers: twelve group and seven bracket matches', () => {
  const ordered = userIds(8)
  let k = 0
  const d = generateTournamentDraft({
    orderedParticipantIds: ordered,
    qualificationRank: rankMap(ordered),
    groupsCount: 2,
    advancementCount: 4,
    eliminationType: 'single',
    stageTracks: {},
    matchKeyFactory: hint => `${hint}-${k++}`,
    userLabel: id => id,
  })
  const group = d.matches.filter(m => m.bracket === 'group')
  const bracket = d.matches.filter(m => m.bracket !== 'group')
  assert.equal(group.length, 12)
  assert.equal(bracket.length, 7)
})

test('track ids rotate per stage by sort order', () => {
  const ordered = userIds(8)
  let k = 0
  const d = generateTournamentDraft({
    orderedParticipantIds: ordered,
    qualificationRank: rankMap(ordered),
    groupsCount: 2,
    advancementCount: 4,
    eliminationType: 'single',
    stageTracks: {
      group: ['tA', 'tB'],
    },
    matchKeyFactory: hint => `${hint}-${k++}`,
    userLabel: id => id,
  })
  const groupMatches = d.matches
    .filter(m => m.stage === 'group')
    .toSorted((a, b) => a.sortOrder - b.sortOrder)
  const trackIds = groupMatches.map(m => m.trackId)
  assert.deepEqual(trackIds.slice(0, 4), ['tA', 'tB', 'tA', 'tB'])
})

test('double elim four: loser semi is listed before upper final', () => {
  const ordered = userIds(8)
  let k = 0
  const d = generateTournamentDraft({
    orderedParticipantIds: ordered,
    qualificationRank: rankMap(ordered),
    groupsCount: 2,
    advancementCount: 2,
    eliminationType: 'double',
    stageTracks: {},
    matchKeyFactory: hint => `${hint}-${k++}`,
    userLabel: id => id,
  })
  const bracket = d.matches.filter(m => m.bracket !== 'group')
  assert.equal(bracket.length, 6)
  assert.equal(bracket[0].stage, 'semi')
  assert.equal(bracket[1].stage, 'semi')
  assert.equal(bracket[2].stage, 'loser_semi')
  assert.equal(bracket[3].stage, 'final')
  assert.equal(bracket[3].bracket, 'upper')
})

test('double elim eight: loser quarters after upper quarters, before upper semis', () => {
  const ordered = userIds(8)
  let k = 0
  const d = generateTournamentDraft({
    orderedParticipantIds: ordered,
    qualificationRank: rankMap(ordered),
    groupsCount: 2,
    advancementCount: 4,
    eliminationType: 'double',
    stageTracks: {},
    matchKeyFactory: hint => `${hint}-${k++}`,
    userLabel: id => id,
  })
  const bracket = d.matches
    .filter(m => m.bracket !== 'group')
    .toSorted((a, b) => a.sortOrder - b.sortOrder)
  assert.deepEqual(
    bracket.slice(0, 4).map(m => ({ b: m.bracket, st: m.stage })),
    [
      { b: 'upper', st: 'quarter' },
      { b: 'upper', st: 'quarter' },
      { b: 'upper', st: 'quarter' },
      { b: 'upper', st: 'quarter' },
    ]
  )
  assert.deepEqual(
    bracket.slice(4, 6).map(m => ({ b: m.bracket, st: m.stage })),
    [
      { b: 'lower', st: 'loser_quarter' },
      { b: 'lower', st: 'loser_quarter' },
    ]
  )
  assert.deepEqual(
    bracket.slice(6, 8).map(m => ({ b: m.bracket, st: m.stage })),
    [
      { b: 'upper', st: 'semi' },
      { b: 'upper', st: 'semi' },
    ]
  )
  const ubFinalIdx = bracket.findIndex(
    m => m.bracket === 'upper' && m.stage === 'final'
  )
  const lastLoserSemiIdx = bracket.findLastIndex(m => m.stage === 'loser_semi')
  assert.ok(lastLoserSemiIdx < ubFinalIdx)
})
