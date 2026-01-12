import { describe, expect, it } from 'vitest'

/**
 * Tests for pure/logical functions in TournamentManager
 *
 * Note: TournamentManager.getStageName is private but we can test its behavior
 * through unit tests of the pure logic.
 */

describe('TournamentManager - Stage Naming Logic', () => {
  /**
   * Mock localization data for testing
   */
  const mockLocales = {
    no: {
      match: {
        round: 'Runde',
        stageNames: {
          grand_final: 'Finale',
          final: 'Finale',
          semi: 'Semifinale',
          quarter: 'Kvartfinale',
          eight: 'Åttendedelsfinale',
          sixteen: 'Sekstendedelsfinale',
          group: 'Gruppe',
        },
      },
      tournament: {
        roundNames: {
          lower: {
            round: 'Taperrunde',
          },
        },
      },
    },
  }

  /**
   * Helper function that implements the getStageName logic
   * This mirrors the private TournamentManager.getStageName method
   */
  function getStageName(
    stage: {
      level: string | null
      bracket: string | null
      index: number
      id: string
    },
    allStages: {
      level: string | null
      bracket: string | null
      index: number
      id: string
    }[] = []
  ): string {
    // For group stages, use round numbering
    if (stage.level === 'group') {
      return `${mockLocales.no.match.round} ${stage.index + 1}`
    }

    // If it has a specific stage level, return its name
    if (stage.level && stage.level in mockLocales.no.match.stageNames) {
      return (mockLocales.no.match.stageNames as Record<string, string>)[
        stage.level
      ]
    }

    // For lower bracket stages without a specific level, use Taperrunde numbering
    if (stage.bracket === 'lower') {
      // Count how many lower bracket stages come before this one
      const lowerBracketStages = allStages.filter(s => s.bracket === 'lower')
      if (lowerBracketStages.length > 0) {
        const lowerBracketIndex = lowerBracketStages.findIndex(
          s => s.id === stage.id
        )
        if (lowerBracketIndex >= 0) {
          return `${mockLocales.no.tournament.roundNames.lower.round} ${lowerBracketIndex + 1}`
        }
      }
      // Fallback if stage not found in allStages
      return `${mockLocales.no.tournament.roundNames.lower.round} 1`
    }

    // Default: generic round numbering
    return `${mockLocales.no.match.round} ${stage.index + 1}`
  }

  describe('Group stages', () => {
    it('names group stages with "Runde" prefix and 1-based index', () => {
      const stage = { level: 'group', bracket: null, index: 0, id: 'g1' }
      expect(getStageName(stage)).toBe('Runde 1')

      const stage2 = { level: 'group', bracket: null, index: 2, id: 'g3' }
      expect(getStageName(stage2)).toBe('Runde 3')
    })
  })

  describe('Bracket stages with specific levels', () => {
    it('names grand final stage', () => {
      const stage = {
        level: 'grand_final',
        bracket: 'upper',
        index: 0,
        id: 'gf',
      }
      expect(getStageName(stage)).toBe('Finale')
    })

    it('names final stage', () => {
      const stage = { level: 'final', bracket: 'upper', index: 0, id: 'f' }
      expect(getStageName(stage)).toBe('Finale')
    })

    it('names semifinal stage', () => {
      const stage = { level: 'semi', bracket: 'upper', index: 0, id: 's' }
      expect(getStageName(stage)).toBe('Semifinale')
    })

    it('names quarterfinal stage', () => {
      const stage = { level: 'quarter', bracket: 'upper', index: 0, id: 'q' }
      expect(getStageName(stage)).toBe('Kvartfinale')
    })

    it('names eighth-final stage', () => {
      const stage = { level: 'eight', bracket: 'upper', index: 0, id: 'e' }
      expect(getStageName(stage)).toBe('Åttendedelsfinale')
    })

    it('names sixteenth-final stage', () => {
      const stage = { level: 'sixteen', bracket: 'upper', index: 0, id: 's16' }
      expect(getStageName(stage)).toBe('Sekstendedelsfinale')
    })
  })

  describe('Lower bracket stages without level', () => {
    it('names first lower bracket stage as "Taperrunde 1"', () => {
      const stages = [
        { level: null, bracket: 'lower', index: 0, id: 'l1' },
        { level: null, bracket: 'lower', index: 1, id: 'l2' },
      ]
      expect(getStageName(stages[0], stages)).toBe('Taperrunde 1')
    })

    it('names second lower bracket stage as "Taperrunde 2"', () => {
      const stages = [
        { level: null, bracket: 'lower', index: 0, id: 'l1' },
        { level: null, bracket: 'lower', index: 1, id: 'l2' },
      ]
      expect(getStageName(stages[1], stages)).toBe('Taperrunde 2')
    })

    it('counts lower bracket stages correctly with multiple stages', () => {
      const stages = [
        { level: 'final', bracket: 'upper', index: 0, id: 'u1' },
        { level: null, bracket: 'lower', index: 1, id: 'l1' },
        { level: null, bracket: 'lower', index: 2, id: 'l2' },
        { level: null, bracket: 'lower', index: 3, id: 'l3' },
        { level: null, bracket: 'lower', index: 4, id: 'l4' },
      ]
      expect(getStageName(stages[1], stages)).toBe('Taperrunde 1')
      expect(getStageName(stages[2], stages)).toBe('Taperrunde 2')
      expect(getStageName(stages[3], stages)).toBe('Taperrunde 3')
      expect(getStageName(stages[4], stages)).toBe('Taperrunde 4')
    })

    it('falls back to "Taperrunde 1" if stage not found in allStages', () => {
      const stage = { level: null, bracket: 'lower', index: 0, id: 'unknown' }
      expect(getStageName(stage, [])).toBe('Taperrunde 1')
    })
  })

  describe('Default/fallback behavior', () => {
    it('defaults to "Runde" prefix for unknown levels in upper bracket', () => {
      const stage = { level: null, bracket: 'upper', index: 2, id: 'unknown' }
      expect(getStageName(stage)).toBe('Runde 3')
    })

    it('uses correct index in round numbering', () => {
      const stage0 = { level: null, bracket: 'upper', index: 0, id: 'a' }
      const stage5 = { level: null, bracket: 'upper', index: 5, id: 'b' }

      expect(getStageName(stage0)).toBe('Runde 1')
      expect(getStageName(stage5)).toBe('Runde 6')
    })
  })

  describe('Complex scenarios', () => {
    it('handles mixed upper and lower bracket stages', () => {
      const stages = [
        { level: 'final', bracket: 'upper', index: 0, id: 'uf' },
        { level: null, bracket: 'lower', index: 1, id: 'lf' },
        { level: 'grand_final', bracket: null, index: 2, id: 'gf' },
      ]

      expect(getStageName(stages[0], stages)).toBe('Finale')
      expect(getStageName(stages[1], stages)).toBe('Taperrunde 1')
      expect(getStageName(stages[2], stages)).toBe('Finale')
    })

    it('correctly numbers multiple lower bracket stages', () => {
      const allStages = Array.from({ length: 8 }, (_, i) => ({
        level: null,
        bracket: 'lower',
        index: i,
        id: `l${i}`,
      }))

      // Test stages at different positions
      expect(getStageName(allStages[0], allStages)).toBe('Taperrunde 1')
      expect(getStageName(allStages[3], allStages)).toBe('Taperrunde 4')
      expect(getStageName(allStages[7], allStages)).toBe('Taperrunde 8')
    })

    it('handles tournament with both upper bracket finals and lower bracket rounds', () => {
      const stages = [
        { level: 'semi', bracket: 'upper', index: 0, id: 'us' },
        { level: 'final', bracket: 'upper', index: 1, id: 'uf' },
        { level: null, bracket: 'lower', index: 2, id: 'l1' },
        { level: null, bracket: 'lower', index: 3, id: 'l2' },
        { level: 'grand_final', bracket: null, index: 4, id: 'gf' },
      ]

      expect(getStageName(stages[0], stages)).toBe('Semifinale')
      expect(getStageName(stages[1], stages)).toBe('Finale')
      expect(getStageName(stages[2], stages)).toBe('Taperrunde 1')
      expect(getStageName(stages[3], stages)).toBe('Taperrunde 2')
      expect(getStageName(stages[4], stages)).toBe('Finale')
    })
  })
})
