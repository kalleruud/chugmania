import { describe, expect, it } from 'vitest'
import StageManager from './stage.manager'

describe('StageManager', () => {
  describe('getStageLevel', () => {
    const stageLevelTests: [number, string][] = [
      [1, 'final'],
      [2, 'semi'],
      [4, 'quarter'],
      [8, 'eight'],
      [16, 'sixteen'],
    ]

    stageLevelTests.forEach(([matches, expectedLevel]) => {
      it(`correctly maps ${matches} matches to "${expectedLevel}"`, () => {
        expect(StageManager.getStageLevel(matches)).toBe(expectedLevel)
      })
    })

    const invalidCounts = [-1, 0, 3, 5, 6, 7, 9, 10, 32, 100]

    invalidCounts.forEach(count => {
      it(`throws for invalid match count: ${count}`, () => {
        expect(() => StageManager.getStageLevel(count)).toThrow()
      })
    })
  })
})
