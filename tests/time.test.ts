import { expect, test } from 'bun:test'
import {
  durationToInputList,
  formatTime,
  inputListToMs,
} from '../common/utils/time'

test('lap times retain thousandths through editing, display and gaps', () => {
  const duration = 62347
  expect(inputListToMs(durationToInputList(duration))).toBe(duration)
  expect(formatTime(duration)).toBe('01:02.347')
  expect(formatTime(7, true)).toBe('0.007')
  expect(formatTime(123, true)).toBe('0.123')
  expect(inputListToMs(durationToInputList(null))).toBe(0)
})
