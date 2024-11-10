import { defineConfig } from 'drizzle-kit'

if (!process.env.DATABASE) throw new Error('Missing environment variable: DATABASE')

export default defineConfig({
  schema: './src/lib/server/db/schema.ts',

  dbCredentials: {
    url: process.env.DATABASE,
  },

  verbose: true,
  strict: true,
  dialect: 'sqlite',
})
