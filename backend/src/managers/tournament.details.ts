import loc from '@common/locale/locales'
import type { TimeEntry } from '@common/models/timeEntry'
import type {
  Slot,
  TournamentDetails,
  TournamentFixture,
  TournamentState,
} from '@common/models/tournament'
import {
  decided,
  groupStandings,
  lapDuration,
  overallStandings,
  qualificationOrder,
  sportingOrder,
  tieBreaks,
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
export function tournamentDetails(
  state: TournamentState,
  entries: TimeEntry[] = [],
  names: Map<string, string> = new Map()
): TournamentDetails {
  const pending = tieBreaks(state)
  const label = (slot: Slot): string => {
    if (slot.kind === 'player') return ''
    if (slot.kind === 'group_rank') {
      const tie = pending.find(
        tie =>
          tie.groupId === slot.groupId &&
          slot.rank >= tie.rank &&
          slot.rank < tie.rank + tie.users.length
      )
      if (tie)
        return loc.no.tournament.tieBreaker(
          tie.users.map(user => names.get(user) ?? user)
        )
      return loc.no.tournament.groupSlot(
        slot.rank,
        groupCode(state.groups.findIndex(g => g.id === slot.groupId))
      )
    }
    const feeder = state.fixtures.find(f => f.id === slot.matchId)
    return `${slot.kind === 'match_winner' ? loc.no.tournament.winnerCode : loc.no.tournament.loserCode} ${feeder ? fixtureLabel(state, feeder) : '?'}`
  }
  const qualification = state.participants
    .map(p => ({
      ...p,
      duration: lapDuration(p),
      latestDuration: lapDuration(p),
    }))
    .toSorted((a, b) => sportingOrder(a, b) || qualificationOrder(a, b))
  const qualificationEntries = entries.filter(
    entry =>
      !entry.deletedAt && qualification.some(p => p.sourceEntry === entry.id)
  )
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
    tieBreaks: pending,
    cancelled: state.cancelled,
    notReadyReason: state.notReadyReason,
    qualificationEntries,
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
      qualificationLaps: 0,
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
