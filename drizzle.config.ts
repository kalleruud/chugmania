import { defineConfig } from 'drizzle-kit'

if (!process.env.DB_FILE_NAME) throw new Error('Missing environment variable: DB_FILE_NAME')

export default defineConfig({
  dbCredentials: {
    url: 'data/' + process.env.DB_FILE_NAME,
  },

  verbose: true,
  strict: true,
  schema: './src/server/db/schema.ts',
  dialect: 'sqlite',
})
