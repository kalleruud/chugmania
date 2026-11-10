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
        'id,name,uid,author,environment,mapType,game,level,goldMedalMs,isLaps\ncsv-numeric-track,001,00042,007,002,003,turbo,custom,12000,true\ncsv-nonlap-track,002,00043,008,004,005,turbo,custom,13000,false',
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
  const tracks = await TrackManager.getAllTracks()
  expect(tracks.find(track => track.id === 'csv-numeric-track')).toMatchObject({
    name: '001',
    uid: '00042',
    author: '007',
    environment: '002',
    mapType: '003',
    goldMedalMs: 12000,
    isLaps: true,
  })
  expect(tracks.find(track => track.id === 'csv-nonlap-track')).toMatchObject({
    name: '002',
    uid: '00043',
    isLaps: false,
  })
})

test('track CSV imports allow unknown levels and preserve raw map metadata', async () => {
  const socket = await login(createUser('csv-map-metadata-admin', 'admin'))
  assertResponse(
    await AdminManager.onImportCsv(socket, {
      table: 'tracks',
      content:
        'id,name,game,environment,mapType\ncsv-next-map,Next map,next,Stadium,TrackMania\\TM_Race\ncsv-unknown-map,Unknown map,next,,',
    })
  )
  const tracks = await TrackManager.getAllTracks()
  expect(tracks.find(track => track.id === 'csv-next-map')).toMatchObject({
    level: null,
    environment: 'Stadium',
    mapType: 'TrackMania\\TM_Race',
    game: 'next',
  })
  expect(tracks.find(track => track.id === 'csv-unknown-map')).toMatchObject({
    level: null,
    environment: null,
    mapType: null,
  })
})
