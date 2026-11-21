import express from 'express'
import ApiManager from '../managers/api.manager'
import { requireApiToken } from './apiAuth'

export function createCalendarRouter(origin: URL) {
  const router = express.Router()
  router.get(
    '/api/sessions/calendar.ics',
    requireApiToken({ allowQuery: true }),
    (req, res) => ApiManager.onGetCalendar(new URL(origin), req, res)
  )
  return router
}
