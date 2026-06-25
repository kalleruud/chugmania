import { spawn } from 'node:child_process'

const bin = process.platform === 'win32' ? '.cmd' : ''

const checks = [
  ['Drizzle', `drizzle-kit${bin}`, ['check']],
  ['ESLint', `eslint${bin}`, ['.', '--cache']],
  [
    'TypeScript node',
    `tsc${bin}`,
    ['--noEmit', '--pretty', 'false', '-p', 'tsconfig.node.json'],
  ],
  [
    'TypeScript app',
    `tsc${bin}`,
    ['--noEmit', '--pretty', 'false', '-p', 'tsconfig.app.json'],
  ],
  [
    'React Doctor',
    `npx${bin}`,
    ['react-doctor@latest', '.', '-y', '--verbose'],
  ],
  ['Prettier', `prettier${bin}`, ['-c', '.']],
]

const failedChecks = []

for (const [name, command, args] of checks) {
  console.log(`\n==> ${name}`)

  const exitCode = await new Promise(resolve => {
    const child = spawn(command, args, { stdio: 'inherit' })

    child.on('error', error => {
      console.error(error.message)
      resolve(1)
    })

    child.on('close', (code, signal) => {
      resolve(code ?? (signal ? 1 : 0))
    })
  })

  if (exitCode !== 0) {
    failedChecks.push(name)
  }
}

if (failedChecks.length > 0) {
  console.error(`\nFailed checks: ${failedChecks.join(', ')}`)
  process.exit(1)
}

console.log('\nAll checks passed')
