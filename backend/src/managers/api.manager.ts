import type { Request, Response } from 'express'
import CalendarManager from './calendar.manager'

const UNKNOWN_ERROR_MESSAGE = 'Ngl, jeg aaner ikke hva som skjedde her...'

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
      error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE
    console.error(timestamp, message, error)
    res.status(statusCode).send(context + ': ' + message)
  }
}
const ApiManager = new ApiManagerClass()

export default ApiManager
