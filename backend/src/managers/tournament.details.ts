import loc from '@common/locale/locales'
import type {
  Slot,
  TournamentDetails,
  TournamentFixture,
  TournamentState,
} from '@common/models/tournament'
import {
  decided,
  groupStandings,
  overallStandings,
  seedingOrder,
} from './tournament.rules'

function groupCode(index: number): string {
  let code = ''
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26))
    code = String.fromCharCode(65 + ((value - 1) % 26)) + code
  return code || '?'
}

export function fixtureLabel(
  state: TournamentState,
  fixture: TournamentFixture
): string {
  const siblings = state.fixtures.filter(
    f => f.bracket === fixture.bracket && f.match.stage === fixture.match.stage
  )
  return `${loc.no.match.stageCode(fixture.match.stage)}${String(siblings.indexOf(fixture) + 1).padStart(2, '0')}`
}
export function tournamentDetails(state: TournamentState): TournamentDetails {
  const label = (slot: Slot): string => {
    if (slot.kind === 'player') return ''
    if (slot.kind === 'group_rank') {
      return loc.no.tournament.groupSlot(
        slot.rank,
        groupCode(state.groups.findIndex(g => g.id === slot.groupId))
      )
    }
    const feeder = state.fixtures.find(f => f.id === slot.matchId)
    return `${slot.kind === 'match_winner' ? loc.no.tournament.winnerCode : loc.no.tournament.loserCode} ${feeder ? fixtureLabel(state, feeder) : '?'}`
  }
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
    participants: state.participants.toSorted(seedingOrder),
    groups: state.groups.map((g, index) => ({
      ...g,
      code: groupCode(index),
      standings: groupStandings(state, g.id),
    })),
    matches: state.fixtures.map(f => ({
      ...f.match,
      tournament: {
        id: state.id,
        label: fixtureLabel(state, f),
        slot1: label(f.slot1),
        slot2: label(f.slot2),
        editableSlots: ['user1', 'user2'].filter(
          (key): key is 'user1' | 'user2' =>
            f.match.status === 'planned' &&
            ((key === 'user1' && (!f.match.user1 || !!f.slot1.override)) ||
              (key === 'user2' && (!f.match.user2 || !!f.slot2.override)))
        ),
        readOnly:
          state.id === 'preview' ||
          state.cancelled ||
          !!state.notReadyReason ||
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
        ...state.fixtures.flatMap(f => (f.match.track ? [f.match.track] : [])),
      ]).size,
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
