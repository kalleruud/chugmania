import type {
  Slot,
  TournamentDetails,
  TournamentFixture,
  TournamentState,
} from '@common/models/tournament'
import { stageName } from '@common/utils/tournament'
import {
  decided,
  groupStandings,
  overallStandings,
  qualificationOrder,
} from './tournament.rules'

export function fixtureLabel(
  state: TournamentState,
  fixture: TournamentFixture
): string {
  const siblings = state.fixtures.filter(
    f => f.bracket === fixture.bracket && f.match.stage === fixture.match.stage
  )
  const stage = stageName(fixture.match.stage)
  if (fixture.groupId)
    return `${state.groups.find(g => g.id === fixture.groupId)?.name ?? ''} · ${stage} ${siblings.indexOf(fixture) + 1}`
  return siblings.length > 1
    ? `${stage} ${siblings.indexOf(fixture) + 1}`
    : stage
}
export function tournamentDetails(state: TournamentState): TournamentDetails {
  const label = (slot: Slot): string => {
    if (slot.kind === 'player') return ''
    if (slot.kind === 'group_rank') {
      const group = state.groups.find(g => g.id === slot.groupId)?.name ?? ''
      if (slot.rank === 1) return `Vinner av gruppe ${group}`
      if (slot.rank === 2) return `Andreplass i gruppe ${group}`
      return `${slot.rank}. plass i gruppe ${group}`
    }
    const feeder = state.fixtures.find(f => f.id === slot.matchId)
    return `${slot.kind === 'match_winner' ? 'Vinner' : 'Taper'} av ${feeder ? fixtureLabel(state, feeder) : ''}`
  }
  const qualification = state.participants.toSorted(qualificationOrder)
  const active = state.fixtures.filter(
    f => f.reset !== 'unneeded' && f.reset !== 'conditional'
  )
  const group = state.fixtures.filter(f => f.bracket === 'group')
  const overall = overallStandings(state)
  const groupSizes = state.groups.map(
    g => state.participants.filter(p => p.groupId === g.id).length
  )
  const guaranteedBracketMatches =
    state.config.eliminationType === 'double' ? 2 : 1
  const bracketRounds = Math.log2(
    state.config.groupsCount * state.config.advancementCount
  )
  return {
    id: state.id,
    config: state.config,
    frozen: !!state.frozenAt,
    cancelled: state.cancelled,
    notReadyReason: state.notReadyReason,
    qualification: qualification.map((p, i) => ({
      ...p,
      rank: i + 1,
      gapLeader:
        p.duration === null
          ? null
          : p.duration - (qualification[0].duration ?? 0),
      gapPrevious:
        p.duration === null
          ? null
          : p.duration - (qualification[i - 1]?.duration ?? p.duration),
    })),
    groups: state.groups.map(g => ({
      ...g,
      standings: groupStandings(state, g.id),
    })),
    matches: state.fixtures.map(f => ({
      ...f.match,
      tournament: {
        id: state.id,
        label: fixtureLabel(state, f),
        dependencies: { slot1: f.slot1, slot2: f.slot2 },
        bracket: f.bracket,
        round: f.round,
        roundSize:
          f.bracket === 'upper'
            ? state.fixtures.filter(
                other => other.bracket === 'upper' && other.round === f.round
              ).length * 2
            : null,
        slot1: label(f.slot1),
        slot2: label(f.slot2),
        readOnly:
          state.id === 'preview' ||
          state.cancelled ||
          !!state.notReadyReason ||
          !f.match.user1 ||
          !f.match.user2 ||
          f.reset === 'conditional' ||
          f.reset === 'unneeded',
        reset: f.reset,
        awarded: f.match.status === 'cancelled' && decided(f.match),
      },
    })),
    standings: overall.rows,
    completed: overall.completed,
    progress: {
      decided: active.filter(f => decided(f.match)).length,
      total: active.length,
      groupDecided: group.filter(f => decided(f.match)).length,
      groupTotal: group.length,
    },
    workloadSummary: {
      tracks: new Set([
        state.config.qualificationTrack,
        ...state.fixtures.flatMap(f => (f.match.track ? [f.match.track] : [])),
      ]).size,
      qualificationLaps: 1,
      minMatches:
        Math.min(...groupSizes) -
        1 +
        (state.participants.length ===
        state.config.groupsCount * state.config.advancementCount
          ? guaranteedBracketMatches
          : 0),
      maxMatches:
        Math.max(...groupSizes) -
        1 +
        (state.config.eliminationType === 'double'
          ? bracketRounds * 2 + 1
          : bracketRounds),
    },
  }
}
