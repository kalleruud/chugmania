// See https://svelte.dev/docs/kit/types#app.d.ts
import type { users } from '$lib/server/db/schema'

// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      user?: typeof users.$inferSelect
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {}
