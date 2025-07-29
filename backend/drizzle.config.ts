import { defineConfig } from 'drizzle-kit'
import process from 'node:process'

export default defineConfig({
  out: './drizzle',
  dialect: 'sqlite',
  schema: './schema',
  casing: 'snake_case',
  dbCredentials: {
    url: 'file:local.db',
  },
})
