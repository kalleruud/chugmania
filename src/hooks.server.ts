import TrackManager from '@/server/managers/track.manager'
import UserManager from '@/server/managers/user.manager'
import { isFailed } from '@/server/managers/utils'
import { fail, redirect, type Handle } from '@sveltejs/kit'

// Seed the database with tracks if it's empty
TrackManager.init()

export const handle: Handle = async ({ event, resolve }) => {
  const result = UserManager.verifyAuth(event.cookies)

  if (isFailed(result)) {
    console.warn(result.message)
    if (!event.url.pathname.startsWith('/login')) {
      console.debug('Redirecting to login page')
      throw redirect(302, '/login')
    }
  } else {
    event.locals.user = result
  }

  return await resolve(event, {
    preload: ({ type }) => type === 'font' || type === 'js' || type === 'css',
  })
}

export function handleError(error: unknown) {
  console.error(error)
  return fail(500, {
    message: error instanceof Error ? error.message : 'Something went wrong',
    error: error,
  })
}
