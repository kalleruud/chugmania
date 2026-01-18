/**
 * Global test setup - runs before Vitest tests
 * Loads environment variables from .env.test
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'

// Set NODE_ENV to 'test' to skip server initialization
process.env.NODE_ENV = 'test'

// Load .env.test for test environment variables
try {
  const envTestPath = path.resolve('.env.test')
  const envContent = readFileSync(envTestPath, 'utf-8')

  // Parse .env file format (KEY=VALUE)
  const lines = envContent.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    // Parse KEY=VALUE
    const [key, ...valueParts] = trimmed.split('=')
    const value = valueParts.join('=').replace(/^["']|["']$/g, '') // Remove surrounding quotes

    if (key) {
      process.env[key.trim()] = value
    }
  }
} catch (error) {
  // Silently ignore if .env.test doesn't exist
  // (process.env might have vars from other sources)
}
