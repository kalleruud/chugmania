import { describe, expect, test } from 'bun:test'
import { getGoogleMapsUrl } from '../frontend/lib/maps'

describe('getGoogleMapsUrl', () => {
  test('replaces whitespace with + and encodes query characters', () => {
    expect(getGoogleMapsUrl('Karl Johans gate 1, Oslo')).toBe(
      'https://maps.google.com/maps?q=Karl+Johans+gate+1%2C+Oslo'
    )
    expect(getGoogleMapsUrl('  Bjørnstjerne\tBjørnsons  plass & 5#?  ')).toBe(
      'https://maps.google.com/maps?q=Bj%C3%B8rnstjerne+Bj%C3%B8rnsons+plass+%26+5%23%3F'
    )
  })

  test('returns undefined for missing or blank locations', () => {
    expect(getGoogleMapsUrl(undefined)).toBeUndefined()
    expect(getGoogleMapsUrl(null)).toBeUndefined()
    expect(getGoogleMapsUrl('')).toBeUndefined()
    expect(getGoogleMapsUrl(' \n\t ')).toBeUndefined()
  })
})
