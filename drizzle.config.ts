import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  out: './drizzle',
  dialect: 'sqlite',
  schema: './backend/database/schema.ts',
  casing: 'camelCase',
  dbCredentials: {
    url: process.env.DATABASE_PATH ?? 'data/db.sqlite',
  },
})
