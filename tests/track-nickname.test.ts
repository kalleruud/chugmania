import loc from '@common/locale/locales'
import { getTrackName, MAX_TRACK_NICKNAME_LENGTH } from '@common/models/track'
import { describe, expect, test } from 'bun:test'
import assert from 'node:assert/strict'
import TrackSource from '../backend/database/sources/track.source'
import TrackManager from '../backend/src/managers/track.manager'
import { broadcast } from '../backend/src/server'
import { assertResponse, createTracks, createUser, login } from './utils'

async function setNickname(email: string, id: string, nickname: string | null) {
  const socket = await login({ email })
  return TrackManager.onEditTrack(socket, {
    type: 'EditTrackRequest',
    id,
    nickname,
  })
}

describe('track nicknames', () => {
  const moderator = createUser('nickname-moderator', 'moderator')
  const player = createUser('nickname-player')
  const [track] = createTracks()

  test.serial('moderators name a track and everyone sees it', async () => {
    const response = await setNickname(moderator.email, track.id, '  Loopen ')
    assertResponse(response)

    expect(response.track).toMatchObject({ name: '001', nickname: 'Loopen' })
    expect(getTrackName(response.track)).toBe('Loopen')
    expect(TrackSource.getActiveById(track.id)?.nickname).toBe('Loopen')
    expect(broadcast).toHaveBeenLastCalledWith(
      'all_tracks',
      expect.arrayContaining([response.track])
    )
  })

  test.serial('an empty nickname falls back to the real name', async () => {
    const response = await setNickname(moderator.email, track.id, '   ')
    assertResponse(response)

    expect(response.track.nickname).toBeNull()
    expect(getTrackName(response.track)).toBe('001')
  })

  test('rejects nicknames that are too long', async () => {
    await assert.rejects(
      setNickname(
        moderator.email,
        track.id,
        'x'.repeat(MAX_TRACK_NICKNAME_LENGTH + 1)
      ),
      { message: loc.no.tracks.nickname.tooLong(MAX_TRACK_NICKNAME_LENGTH) }
    )
  })

  test('rejects unknown tracks', async () => {
    await assert.rejects(setNickname(moderator.email, 'missing-track', 'Nope'))
  })

  test('players cannot set nicknames', async () => {
    await assert.rejects(setNickname(player.email, track.id, 'Mine'))
    expect(TrackSource.getActiveById(track.id)?.nickname).not.toBe('Mine')
  })
})
