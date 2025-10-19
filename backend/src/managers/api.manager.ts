import type { Request, Response } from 'express'
import CalendarManager from './calendar.manager'

export default class ApiManager {
  static async handleGetAllSessionsCalendar(
    baseUrl: URL,
    req: Request,
    res: Response
  ) {
    try {
      const calendar = await CalendarManager.getAllSessionsCalendar(
        baseUrl.toString()
      )

      res
        .type('text/calendar; charset=utf-8')
        .setHeader('Content-Disposition', 'inline; filename="sessions.ics"')
        .setHeader('Cache-Control', 'no-store')
        .send(calendar)
    } catch (error) {
      ApiManager.handleError(
        res,
        error,
        'Failed to create sessions calendar',
        500
      )
    }
  }

  static async handleGetSessionCalendar(
    baseUrl: URL,
    req: Request,
    res: Response
  ) {
    try {
      const sessionId = req.params.id
      if (!sessionId) {
        res.status(400).send('Session id is required')
        return
      }

      const calendar = await CalendarManager.getSessionCalendar(
        sessionId,
        baseUrl.toString()
      )

      res
        .type('text/calendar; charset=utf-8')
        .setHeader(
          'Content-Disposition',
          `inline; filename="session-${sessionId}.ics"`
        )
        .setHeader('Cache-Control', 'no-store')
        .send(calendar)
    } catch (error) {
      if (error instanceof Error && error.message === 'Session not found') {
        res.status(404).send('Session not found')
        return
      }
      ApiManager.handleError(
        res,
        error,
        'Failed to create session calendar',
        500
      )
    }
  }

  private static handleError(
    res: Response,
    error: unknown,
    context: string,
    statusCode: number
  ) {
    const timestamp = new Date().toISOString()
    if (error instanceof Error)
      console.error(timestamp, context, error.message, error.stack)
    else console.error(timestamp, context, error)
    res.status(statusCode).send(context)
  }
}
