const checks = [
  ['Drizzle', 'drizzle-kit', ['check']],
  ['ESLint', 'eslint', ['.', '--cache']],
  [
    'TypeScript backend',
    'tsc',
    ['--noEmit', '--pretty', 'false', '-p', 'tsconfig.node.json'],
  ],
  [
    'TypeScript app',
    'tsc',
    ['--noEmit', '--pretty', 'false', '-p', 'tsconfig.app.json'],
  ],
  ['Prettier', 'prettier', ['-c', '.']],
]

const failedChecks = []

for (const [name, command, args] of checks) {
  console.log(`\n==> ${name}`)

  const { success } = Bun.spawnSync(
    [process.execPath, '--bun', command, ...args],
    { stdout: 'inherit', stderr: 'inherit' }
  )

  if (!success) {
    failedChecks.push(name)
  }
}

if (failedChecks.length > 0) {
  console.error(`\nFailed checks: ${failedChecks.join(', ')}`)
  process.exit(1)
}

console.log('\nAll checks passed')
