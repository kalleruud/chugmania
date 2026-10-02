import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import SegmentedProgress from './SegmentedProgress'

test('renders independent match progress and signup counts, including empty sections', () => {
  const matches = renderToStaticMarkup(
    <SegmentedProgress
      segments={[
        {
          label: 'Groups',
          value: 28,
          total: 28,
          colorClassName: 'bg-emerald-500',
        },
        { label: 'Bracket', value: 4, total: 14, colorClassName: 'bg-sky-500' },
      ]}
    />
  )
  assert.match(matches, /aria-valuenow="100"/)
  assert.match(matches, /aria-valuenow="28\.571/)
  assert.match(matches, /aria-valuetext="4\/14"/)

  const signups = renderToStaticMarkup(
    <SegmentedProgress
      segments={[
        { label: 'Yes', value: 3, colorClassName: 'bg-emerald-500' },
        { label: 'No', value: 0, colorClassName: 'bg-red-500' },
      ]}
    />
  )
  assert.equal((signups.match(/role="progressbar"/g) ?? []).length, 1)
  assert.match(signups, /aria-valuetext="3"/)
  assert.doesNotMatch(signups, /NaN|Infinity/)
})
