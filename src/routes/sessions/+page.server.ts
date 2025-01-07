import SessionManager from '@/server/managers/session.manager'
import { type Actions } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const load = (async ({ locals }) => {
  if (!locals.user) throw new Error('Unauthorized')

  return {
    sessions: await SessionManager.getAll(),
    user: locals.user,
  }
}) satisfies PageServerLoad

export const actions = {
  create: async ({ locals }) => {
    console.debug('Received create session request')
    if (!locals.user) throw new Error('Unauthorized')
    if (locals.user.role !== 'admin') throw new Error('Forbidden')

    await SessionManager.create('tournament', locals.user)

    return { success: true }
  },
} satisfies Actions
