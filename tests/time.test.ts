import { describe, expect, test } from 'bun:test'
import {
  durationToInputList,
  formatTime,
  inputListToMs,
} from '../common/utils/time'

describe('Lap time formatting and input', () => {
  test('Always displays minutes, seconds and three millisecond digits', () => {
    const times: [number, string][] = [
      [0, '00:00.000'],
      [1, '00:00.001'],
      [125, '00:00.125'],
      [28001, '00:28.001'],
      [59999, '00:59.999'],
      [60000, '01:00.000'],
      [60501, '01:00.501'],
      [6000000, '100:00.000'],
    ]
    for (const [milliseconds, formatted] of times)
      expect(formatTime(milliseconds)).toBe(formatted)
  })

  test('Editing a lap preserves every millisecond digit', () => {
    for (const duration of [1, 125, 28001, 59999, 60000, 60501, 5999999]) {
      const digits = durationToInputList(duration)
      expect(digits).toHaveLength(7)
      expect(inputListToMs(digits)).toBe(duration)
    }
    expect(durationToInputList(60501)).toEqual(['', '1', '', '', '5', '', '1'])
  })

  test('Empty inputs and empty digit slots represent zero', () => {
    for (const duration of [null, undefined, 0]) {
      const digits = durationToInputList(duration)
      expect(digits).toEqual(['', '', '', '', '', '', ''])
      expect(inputListToMs(digits)).toBe(0)
    }
    expect(inputListToMs(['', '', '', '2', '', '', '1'])).toBe(2001)
  })
})
