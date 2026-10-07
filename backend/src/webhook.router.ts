import { isWebhookEvent } from '@common/models/webhook'
import { isRecord } from '@common/utils/utils'
import express, { type ErrorRequestHandler } from 'express'
import { timingSafeEqual } from 'node:crypto'
import WebhookManager, { WebhookError } from './managers/webhook.manager'

export function createWebhookRouter() {
  const router = express.Router()
  router.post(
    '/api/webhook',
    (req, res, next) => {
      const token = process.env.TRACKMANIA_WEBHOOK_TOKEN
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
    },
    express.text({ type: 'application/json', limit: '256kb' }),
    (req, res) => {
      try {
        if (typeof req.body !== 'string')
          throw new WebhookError(400, 'INVALID_EVENT', 'JSON body required')
        const event: unknown = JSON.parse(req.body)
        if (!isWebhookEvent(event))
          throw new WebhookError(
            400,
            'INVALID_EVENT',
            'Invalid webhook payload'
          )
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
        WebhookManager.receive(event, req.body)
        res.status(204).end()
      } catch (error) {
        if (error instanceof SyntaxError)
          res
            .status(400)
            .json({ code: 'INVALID_JSON', message: 'Invalid JSON body' })
        else if (error instanceof WebhookError)
          res
            .status(error.status)
            .json({ code: error.code, message: error.message })
        else
          res.status(500).json({
            code: 'RECEIVER_ERROR',
            message: 'Could not persist webhook event',
          })
      }
    }
  )
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
      message: oversized
        ? 'Webhook body exceeds 256kb'
        : 'Invalid webhook body',
    })
  }
  router.use(handleBodyError)
  return router
}
