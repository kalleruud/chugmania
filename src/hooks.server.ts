import { verifyToken } from '$lib/server/db'
import { fail, redirect, type Handle } from '@sveltejs/kit'

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

  return resolve(event, {
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
