import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ObjectViewer from '../frontend/components/object-viewer/ObjectViewer'

const render = (value: unknown) =>
  renderToStaticMarkup(createElement(ObjectViewer, { value }))

describe('Object viewer', () => {
  test('automatically labels and renders primitive fields without configuration', () => {
    const html = render({
      firstName: 'Ada',
      lap_count: 12345,
      active: true,
      missing: null,
      absent: undefined,
      blank: '',
      disabled: false,
    })
    for (const text of [
      'First Name',
      'Lap count',
      'Ada',
      '12',
      '345',
      'Ja',
      'Nei',
      'null',
      'undefined',
      'Ikke satt',
    ])
      expect(html).toContain(text)
    expect(html).toContain('Kopier verdi')
  })

  test('recognizes dates and timestamp fields without interpreting ordinary numbers as dates', () => {
    const html = render({
      createdAt: 0,
      serializedDate: '2026-11-15T12:30:00Z',
      dateObject: new Date('2026-11-15T12:30:00Z'),
      score: 42,
      invalidDate: '2026-99-99',
    })
    expect(html.match(/<time /g)).toHaveLength(3)
    expect(html).toContain('1970')
    expect(html).toContain('42')
    expect(html).toContain('2026-99-99')
  })

  test('offers expandable JSON and nested collections, including empty collections', () => {
    const html = render({
      payload: '{"result":{"score":42}}',
      malformed: '{broken json',
      nested: { child: { value: true } },
      list: [1, 2],
      emptyObject: {},
      emptyList: [],
    })
    expect(html).toContain('JSON')
    expect(html).toContain('&quot;score&quot;: 42')
    expect(html).toContain('{broken json')
    expect(html).toContain('1 felt')
    expect(html).toContain('2 elementer')
    expect(html).toContain('{}')
    expect(html).toContain('[]')
    expect(html).not.toContain('Child')
  })

  test('escapes content and only creates safe HTTP links', () => {
    const html = render({
      website: 'https://example.test/path',
      unsafe: 'javascript:alert(1)',
      content: '<script>alert(1)</script>',
    })
    expect(html).toContain('href="https://example.test/path"')
    expect(html).not.toContain('href="javascript:')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  test('handles root values, long text, and special numbers', () => {
    expect(render(null)).toContain('null')
    expect(render(undefined)).toContain('undefined')
    expect(render('x'.repeat(500))).toContain('Vis hele teksten')
    expect(render(123n)).toContain('123')
    expect(render(1e-25)).toContain('0000000000000000000000001')
    expect(
      render(123456789012345678901234567890n).replace(/[\u00a0\u202f]/g, '')
    ).toContain('123456789012345678901234567890')
    expect(render(Number.NaN)).toContain('NaN')
  })
})
