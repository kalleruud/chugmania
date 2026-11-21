import type { UserInfo } from '@common/models/user'
import type { NextFunction, Request, RequestHandler, Response } from 'express'
import ApiTokenManager from '../managers/apiToken.manager'

declare module 'express-serve-static-core' {
  interface Locals {
    user?: UserInfo
  }
}

type ApiTokenOptions = {
  allowQuery?: boolean
  roles?: UserInfo['role'][]
}

const BEARER_PREFIX = 'Bearer '

function readToken(req: Request, allowQuery: boolean): string | undefined {
  const header = req.get('Authorization')
  if (header?.startsWith(BEARER_PREFIX))
    return header.slice(BEARER_PREFIX.length).trim()
  if (allowQuery && typeof req.query.token === 'string') return req.query.token
  return undefined
}

export function requireApiToken({
  allowQuery = false,
  roles,
}: ApiTokenOptions = {}): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    ApiTokenManager.authenticate(readToken(req, allowQuery), roles)
      .then(user => {
        res.locals.user = user
        next()
      })
      .catch(() => {
        res.status(401).json({
          code: 'UNAUTHORIZED',
          message: 'A valid API token is required',
        })
      })
  }
}

export function getApiUser(res: Response): UserInfo {
  const user = res.locals.user
  if (!user) throw new Error('Missing API user')
  return user
}
