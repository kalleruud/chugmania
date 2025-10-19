import type { Request, Response } from 'express'
import CalendarManager from './calendar.manager'

export default class ApiManager {
  static async handleGetAllSessionsCalendar(req: Request, res: Response) {
    try {
      const protocol = req.protocol
      const host = req.get('host')
      const port = process.env.PORT ? Number.parseInt(process.env.PORT) : 6996
      const baseUrl = host
        ? `${protocol}://${host}`
        : (process.env.ORIGIN ?? `http://localhost:${port}`)

      const calendar = await CalendarManager.getAllSessionsCalendar(
        protocol,
        host,
        baseUrl
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

  static async handleGetSessionCalendar(req: Request, res: Response) {
    try {
      const sessionId = req.params.id
      if (!sessionId) {
        res.status(400).send('Session id is required')
        return
      }

      const protocol = req.protocol
      const host = req.get('host')
      const port = process.env.PORT ? Number.parseInt(process.env.PORT) : 6996
      const baseUrl = host
        ? `${protocol}://${host}`
        : (process.env.ORIGIN ?? `http://localhost:${port}`)

      const calendar = await CalendarManager.getSessionCalendar(
        sessionId,
        protocol,
        host,
        baseUrl
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
    if (error instanceof Error) {
      console.error(timestamp, context, error.message, error.stack)
    } else {
      console.error(timestamp, context, error)
    }
    res.status(statusCode).send(context)
  }
}
