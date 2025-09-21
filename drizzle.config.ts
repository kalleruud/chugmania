import { defineConfig } from 'drizzle-kit'

const DB_URL = process.env.DB_URL
if (!DB_URL) throw Error("Missing environment varible 'DB_URL'")

export default defineConfig({
  out: './drizzle',
  dialect: 'sqlite',
  schema: './backend/database/schema.ts',
  casing: 'camelCase',
  dbCredentials: {
    url: DB_URL,
  },
})
