import { verifyToken } from '$lib/server/db'
import { redirect, type Handle } from '@sveltejs/kit'

export const handle: Handle = async ({ event, resolve }) => {
  const token = event.cookies.get('auth')
  if (token) {
    // User is logged in
    event.locals.user = verifyToken(token)
    if (!event.locals.user) {
      console.warn('Invalid token, deleting auth cookie')
      event.cookies.delete('auth', { path: '/' })
      throw redirect(302, '/login')
    }
    console.log(event.url.pathname)
    if (event.url.pathname === '/login') {
      // Redirect to home page
      console.info('User logged in, redirecting to home page')
      throw redirect(302, '/')
    }
  } else if (event.url.pathname !== '/login') {
    // Redirect to login page
    console.warn('User not logged in, redirecting to login page')
    throw redirect(302, '/login')
  }

  return resolve(event)
}
