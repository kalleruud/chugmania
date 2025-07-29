import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  out: './drizzle',
  dialect: 'sqlite',
  schema: './schema',
  casing: 'snake_case',
  dbCredentials: {
    url: 'filedata/db.sqlite',
  },
})
