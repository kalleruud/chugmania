# Capture HTTP contract (v1)

The Openplanet plugin (separate repo) POSTs finished-heat results to Chugmania.

## Endpoint
`POST /api/capture/heat`

## Auth
Header `Authorization: Bearer <CAPTURE_TOKEN>` — must equal the backend's `CAPTURE_TOKEN` env var.
If the backend has no `CAPTURE_TOKEN` set, the endpoint returns `503` (feature disabled).

## Body (application/json)
```json
{
  "contractVersion": 1,
  "heatId": "string — stable across retries; idempotency key",
  "mapUid": "string — TM2020 MapUid",
  "mapName": "string",
  "mapAuthor": "string (optional)",
  "playerCount": 1,
  "results": [{ "slot": 1, "bestTimeMs": 42300 }],
  "serverTime": 0
}
```

- `playerCount` 1 → solo, 2 → 1v1. Other values are logged and discarded.
- `results` carries one entry per slot with that slot's best finish time for the map visit.

## Responses
- `200 { success: true, stored: boolean }` — `stored:false` means there was no active session, so the heat was ignored (do NOT retry).
- `401` — bad/missing token.
- `400` — malformed payload.
- `503` — capture disabled (no token configured).

## Idempotency
Re-POSTing the same `heatId` is a no-op. Retry freely on network failure.

## Versioning
Bump `contractVersion` on any breaking change; the backend logic for v1 lives in `backend/src/managers/capture.logic.ts`.
