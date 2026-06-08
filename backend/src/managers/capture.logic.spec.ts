import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  isHeatPayload,
  isSupportedHeat,
  templateFor,
  winningSlot,
  validateAssignments,
} from './capture.logic'

const validPayload = {
  contractVersion: 1,
  heatId: 'h1',
  mapUid: 'map-uid',
  mapName: 'My Map',
  playerCount: 2,
  results: [
    { slot: 1, bestTimeMs: 42300 },
    { slot: 2, bestTimeMs: 45100 },
  ],
}

test('isHeatPayload accepts a valid payload', () => {
  assert.equal(isHeatPayload(validPayload), true)
})

test('isHeatPayload rejects missing results', () => {
  assert.equal(isHeatPayload({ ...validPayload, results: undefined }), false)
})

test('isHeatPayload rejects a non-numeric time', () => {
  assert.equal(
    isHeatPayload({ ...validPayload, results: [{ slot: 1, bestTimeMs: 'x' }] }),
    false
  )
})

test('templateFor maps player counts', () => {
  assert.equal(templateFor(1), 'solo')
  assert.equal(templateFor(2), 'duel')
  assert.equal(templateFor(3), null)
})

test('winningSlot returns the faster slot', () => {
  assert.equal(winningSlot([
    { slot: 1, duration: 45100 },
    { slot: 2, duration: 42300 },
  ]), 2)
})

test('winningSlot returns null on a tie', () => {
  assert.equal(winningSlot([
    { slot: 1, duration: 42300 },
    { slot: 2, duration: 42300 },
  ]), null)
})

test('isSupportedHeat returns true for playerCount 1 with contractVersion 1', () => {
  assert.equal(isSupportedHeat({ ...validPayload, playerCount: 1, results: [{ slot: 1, bestTimeMs: 42300 }] }), true)
})

test('isSupportedHeat returns true for playerCount 2 with contractVersion 1', () => {
  assert.equal(isSupportedHeat({ ...validPayload, playerCount: 2 }), true)
})

test('isSupportedHeat returns false for playerCount 3', () => {
  assert.equal(isSupportedHeat({ ...validPayload, playerCount: 3 }), false)
})

test('isSupportedHeat returns false when contractVersion is not 1', () => {
  assert.equal(isSupportedHeat({ ...validPayload, contractVersion: 2 }), false)
})

test('validateAssignments requires one per slot and distinct users for duels', () => {
  const slots = [1, 2]
  assert.equal(
    validateAssignments(slots, [
      { slot: 1, user: 'a' },
      { slot: 2, user: 'b' },
    ]),
    null
  )
  assert.equal(
    typeof validateAssignments(slots, [{ slot: 1, user: 'a' }]),
    'string'
  )
  assert.equal(
    typeof validateAssignments(slots, [
      { slot: 1, user: 'a' },
      { slot: 2, user: 'a' },
    ]),
    'string'
  )
})
