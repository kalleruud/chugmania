import { defineConfig } from 'drizzle-kit'

if (!process.env.DB_FILE_NAME) throw new Error('Missing environment variable: DB_FILE_NAME')

export default defineConfig({
  schema: './src/lib/server/db/schema.ts',

  dbCredentials: {
    url: 'data/' + process.env.DB_FILE_NAME,
  },

  verbose: true,
  strict: true,
  dialect: 'sqlite',
})
