import { expect, test } from 'bun:test'
import AdminManager from '../backend/src/managers/admin.manager'
import TrackManager from '../backend/src/managers/track.manager'
import { assertResponse, createUser, login } from './utils'

test('track CSV round trips preserve numeric text and numeric medal times', async () => {
  const socket = await login(createUser('csv-track-admin', 'admin'))
  assertResponse(
    await AdminManager.onImportCsv(socket, {
      table: 'tracks',
      content:
        'id,name,uid,author,environment,type,game,level,goldMedalMs\ncsv-numeric-track,001,00042,007,002,003,turbo,custom,12000',
    })
  )
  const exported = await AdminManager.onExportCsv(socket, { table: 'tracks' })
  assertResponse(exported)
  assertResponse(
    await AdminManager.onImportCsv(socket, {
      table: 'tracks',
      content: exported.csv,
    })
  )
  expect(
    (await TrackManager.getAllTracks()).find(
      track => track.id === 'csv-numeric-track'
    )
  ).toMatchObject({
    name: '001',
    uid: '00042',
    author: '007',
    environment: '002',
    type: '003',
    goldMedalMs: 12000,
  })
})
