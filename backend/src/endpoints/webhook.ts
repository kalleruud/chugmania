import { isRecord } from '@common/utils/utils'
import express, {
  type ErrorRequestHandler,
  type NextFunction,
  type Request,
  type Response,
} from 'express'
import { timingSafeEqual } from 'node:crypto'
import SessionSource from '../../database/sources/session.source'
import WebhookManager, { WebhookError } from '../managers/webhook.manager'
import { isWebhookEvent } from '../models/webhook'
import type { Event } from '../models/webhook.generated'

export function createWebhookRouter() {
  const router = express.Router()
  router.post(
    '/api/webhook',
    logWebhookOutcome,
    authenticateWebhook,
    express.text({ type: 'application/json', limit: '256kb' }),
    receiveWebhook
  )
  router.use(handleBodyError)
  return router
}

function logWebhookOutcome(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  res.once('finish', () => {
    const outcome: unknown = res.locals.webhookOutcome ?? 'Rejected'
    console.info(
      new Date().toISOString(),
      `Webhook ${req.get('event_type') ?? 'unknown'} (${req.get('event-id') ?? 'no ID'}): ${String(outcome)} [HTTP ${res.statusCode}]`
    )
  })
  next()
}

function authenticateWebhook(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = process.env.WEBHOOK_TOKEN
  const expected = Buffer.from(`Bearer ${token ?? ''}`)
  const provided = Buffer.from(req.get('Authorization') ?? '')
  if (
    !token ||
    expected.length !== provided.length ||
    !timingSafeEqual(expected, provided)
  ) {
    res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Webhook authentication required',
    })
    return
  }
  next()
}

function parseWebhookEvent(req: Request): { event: Event; rawPayload: string } {
  if (typeof req.body !== 'string')
    throw new WebhookError(400, 'INVALID_EVENT', 'JSON body required')
  const event: unknown = JSON.parse(req.body)
  if (!isWebhookEvent(event))
    throw new WebhookError(400, 'INVALID_EVENT', 'Invalid webhook payload')
  if (
    req.get('event_type') !== event.type ||
    req.get('event-id') !== event.eventId ||
    req.get('event-sequence') !== String(event.sequence)
  )
    throw new WebhookError(
      400,
      'HEADER_MISMATCH',
      'Event headers must match the payload'
    )
  return { event, rawPayload: req.body }
}

function receiveWebhook(req: Request, res: Response): void {
  try {
    const { event, rawPayload } = parseWebhookEvent(req)
    res.locals.webhookOutcome = WebhookManager.receive(event, rawPayload)
    res.status(204).end()
  } catch (error) {
    respondToWebhookError(error, res)
  }
}

function respondToWebhookError(error: unknown, res: Response): void {
  res.locals.webhookOutcome =
    error instanceof WebhookError ? error.message : 'Rejected'
  if (error instanceof SyntaxError) {
    res.status(400).json({ code: 'INVALID_JSON', message: 'Invalid JSON body' })
    return
  }
  if (error instanceof WebhookError) {
    if (error.code === 'NO_ACTIVE_SESSION') {
      const nextSession = SessionSource.findNext(new Date())
      if (nextSession)
        res.setHeader('Retry-After', nextSession.date.toUTCString())
    }
    res.status(error.status).json({ code: error.code, message: error.message })
    return
  }
  res.status(500).json({
    code: 'RECEIVER_ERROR',
    message: 'Could not persist webhook event',
  })
}

const handleBodyError: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  next
) => {
  if (res.headersSent) {
    next(error)
    return
  }
  const status =
    isRecord(error) && typeof error.status === 'number' ? error.status : 400
  const oversized = status === 413
  res.status(status).json({
    code: oversized ? 'BODY_TOO_LARGE' : 'INVALID_BODY',
    message: oversized ? 'Webhook body exceeds 256kb' : 'Invalid webhook body',
  })
}
