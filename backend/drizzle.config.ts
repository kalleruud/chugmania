import { defineConfig } from 'drizzle-kit'
import 'jsr:@std/dotenv/load'

const db_file = Deno.env.get('DB_FILE_NAME')
if (!db_file) throw Error("Missing environment varible 'DB_FILE_NAME'")

export default defineConfig({
  out: './drizzle',
  dialect: 'sqlite',
  schema: './database/schema.ts',
  casing: 'snake_case',
  dbCredentials: {
    url: db_file,
  },
})
