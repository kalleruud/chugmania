const url = process.env.CAPTURE_URL ?? 'http://localhost:6996/api/capture/heat'
const token = process.env.CAPTURE_TOKEN ?? ''
const playerCount = Number(process.argv[2] ?? '2')

const results =
  playerCount === 1
    ? [{ slot: 1, bestTimeMs: 41000 }]
    : [
        { slot: 1, bestTimeMs: 42300 },
        { slot: 2, bestTimeMs: 45100 },
      ]

const body = {
  contractVersion: 1,
  heatId: `mock-${Date.now()}`,
  mapUid: 'mock-map-uid',
  mapName: 'Mock Map',
  playerCount,
  results,
}

const res = await fetch(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify(body),
})
console.log(res.status, await res.json())
