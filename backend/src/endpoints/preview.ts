import { tryCatchAsync } from '@common/utils/try-catch'
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express'
import path from 'node:path'
import PreviewManager from '../managers/preview.manager'

export type TemplateLoader = (url: string) => Promise<string>

export function createPreviewRouter(origin: URL, loadTemplate: TemplateLoader) {
  const router = express.Router()
  router.get('/api/preview/{*path}', sendImage)
  router.get('/{*page}', (req, res, next) =>
    sendPage(origin, loadTemplate, req, res, next)
  )
  return router
}

function isPageRequest(pathname: string): boolean {
  return (
    path.extname(pathname) === '' &&
    !pathname.startsWith('/@') &&
    pathname !== '/api' &&
    !pathname.startsWith('/api/')
  )
}

async function sendImage(req: Request, res: Response): Promise<void> {
  const segments: unknown = req.params.path
  if (
    !Array.isArray(segments) ||
    !segments.every(s => typeof s === 'string') ||
    !segments.at(-1)?.endsWith('.png')
  ) {
    res.sendStatus(404)
    return
  }

  const pathname = PreviewManager.fromImagePath(segments)
  const { data, error } = await tryCatchAsync(PreviewManager.getImage(pathname))
  if (error) {
    console.error(
      new Date().toISOString(),
      `Failed to render preview image for '${pathname}'`,
      error
    )
    res.sendStatus(500)
    return
  }

  res.type('png').setHeader('Cache-Control', 'public, max-age=3600').send(data)
}

async function sendPage(
  origin: URL,
  loadTemplate: TemplateLoader,
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!isPageRequest(req.path)) {
    next()
    return
  }

  const { data, error } = await tryCatchAsync(
    loadTemplate(req.originalUrl).then(html =>
      PreviewManager.injectMeta(html, req.path, origin)
    )
  )
  if (error) {
    next(error)
    return
  }

  res.type('html').setHeader('Cache-Control', 'no-cache').send(data)
}
