// See https://svelte.dev/docs/kit/types#app.d.ts
import type { PublicUser } from '@/server/managers/user.manager'

// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      user?: PublicUser
      redirect?: string
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {}
