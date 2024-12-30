import LoginManager from '@/server/managers/login.manager'
import TrackManager from '@/server/managers/track.manager'
import UserManager from '@/server/managers/user.manager'
import { redirect, type Handle } from '@sveltejs/kit'

// Seed the database with tracks if it's empty
TrackManager.init()

export const handle: Handle = async ({ event, resolve }) => {
  const result = LoginManager.verifyAuth(event.cookies)

  if (!UserManager.isUser(result)) {
    console.warn(result.status, result.data.message)
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
