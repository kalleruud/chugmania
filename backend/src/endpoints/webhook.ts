import type { Result } from '@common/utils/try-catch'
import { isRecord } from '@common/utils/utils'
import express, {
  type ErrorRequestHandler,
  type NextFunction,
  type Request,
  type Response,
  type Router,
} from 'express'
import { timingSafeEqual } from 'node:crypto'
import SessionSource from '../../database/sources/session.source'
import WebhookManager, { WebhookError } from '../managers/webhook.manager'
import { isWebhookEvent } from '../models/webhook'
import type { Event } from '../models/webhook.generated'

export function createWebhookRouter(): Router {
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

function parseWebhookEvent(
  req: Request
): Result<{ event: Event; rawPayload: string }, WebhookError> {
  if (typeof req.body !== 'string')
    return {
      data: null,
      error: new WebhookError(400, 'INVALID_EVENT', 'JSON body required'),
    }
  let event: unknown
  try {
    event = JSON.parse(req.body)
  } catch {
    return {
      data: null,
      error: new WebhookError(400, 'INVALID_JSON', 'Invalid JSON body'),
    }
  }
  if (!isWebhookEvent(event))
    return {
      data: null,
      error: new WebhookError(400, 'INVALID_EVENT', 'Invalid webhook payload'),
    }
  if (
    req.get('event_type') !== event.type ||
    req.get('event-id') !== event.eventId ||
    req.get('event-sequence') !== String(event.sequence)
  )
    return {
      data: null,
      error: new WebhookError(
        400,
        'HEADER_MISMATCH',
        'Event headers must match the payload'
      ),
    }
  return { data: { event, rawPayload: req.body }, error: null }
}

function receiveWebhook(req: Request, res: Response): void {
  try {
    const parsed = parseWebhookEvent(req)
    if (parsed.error) {
      respondToWebhookError(parsed.error, req, res)
      return
    }
    const result = WebhookManager.receive(
      parsed.data.event,
      parsed.data.rawPayload
    )
    if (result.error) {
      respondToWebhookError(result.error, req, res)
      return
    }
    res.locals.webhookOutcome = result.data
    res.status(204).end()
  } catch (error) {
    respondToWebhookError(error, req, res)
  }
}

function respondToWebhookError(
  error: unknown,
  req: Request,
  res: Response
): void {
  res.locals.webhookOutcome =
    error instanceof WebhookError ? error.message : 'Rejected'
  if (error instanceof WebhookError) {
    if (error.code === 'NO_ACTIVE_SESSION') {
      const nextSession = SessionSource.findNext(new Date())
      if (nextSession)
        res.setHeader('Retry-After', nextSession.date.toUTCString())
    }
    res.status(error.status).json({ code: error.code, message: error.message })
    return
  }
  console.error(
    'Webhook receiver failed',
    {
      eventId: req.get('event-id'),
      eventType: req.get('event_type'),
    },
    error
  )
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
