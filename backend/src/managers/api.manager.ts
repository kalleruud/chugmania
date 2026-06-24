import loc from '@/lib/locales'
import type { Request, Response } from 'express'
import CalendarManager from './calendar.manager'

class ApiManagerClass {
  async onGetCalendar(baseUrl: URL, _: Request, res: Response) {
    try {
      const calendar = await CalendarManager.getAllSessionsCalendar(baseUrl)

      res
        .type('text/calendar; charset=utf-8')
        .setHeader('Content-Disposition', 'inline; filename="sessions.ics"')
        .setHeader('Cache-Control', 'no-store')
        .send(calendar)
    } catch (error) {
      ApiManager.handleError(res, 500, 'Failed to create calendar', error)
    }
  }

  private handleError(
    res: Response,
    statusCode: number,
    context: string,
    error: unknown
  ) {
    const timestamp = new Date().toISOString()
    const message =
      error instanceof Error
        ? error.message
        : loc.no.error.messages.unknown_error
    console.error(timestamp, message, error)
    res.status(statusCode).send(context + ': ' + message)
  }
}
const ApiManager = new ApiManagerClass()

export default ApiManager
