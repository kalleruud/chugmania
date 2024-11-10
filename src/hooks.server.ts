import TrackManager from '@/server/managers/track.manager'
import UserManager from '@/server/managers/user.manager'
import { isFailed } from '@/server/managers/utils'
import { fail, redirect, type Handle } from '@sveltejs/kit'

// Seed the database with tracks if it's empty
TrackManager.init().then(() => console.info('Tracks initialized'))

export const handle: Handle = async ({ event, resolve }) => {
  if (!event.url.pathname.startsWith('/login')) {
    const result = UserManager.verifyAuth(event.cookies)
    if (isFailed(result)) {
      console.warn(result.message + ',', 'redirecting to login page')
      throw redirect(303, '/login')
    }
    event.locals.user = result
  }

  const response = await resolve(event, {
    preload: ({ type }) => type === 'font' || type === 'js' || type === 'css',
  })

  return response
}

export function handleError(error: unknown) {
  console.error(error)
  return fail(500, {
    message: error instanceof Error ? error.message : 'Something went wrong',
    error: error,
  })
}
