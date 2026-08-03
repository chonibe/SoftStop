import { access } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, '.vitepress/dist')

const required = [
  'index.html',
  'start/getting-started.html',
  'start/concept.html',
  'start/adoption-contract.html',
  'integrate/workflow.html',
  'integrate/sdk-js.html',
  'integrate/examples.html',
  'api/check.html',
  'api/record.html',
  'api/verify.html',
  'api/health.html',
  'api/errors.html',
  'policies/index.html',
  'policies/default-pack.html',
  'policies/action-types.html',
  'self-host/index.html',
  'self-host/docker.html',
  'self-host/env.html',
  'self-host/storage.html',
  'ops/orphan-rate.html',
  'ops/security.html',
  'ops/troubleshooting.html'
]

const missing = []
for (const rel of required) {
  try {
    await access(join(dist, rel))
  } catch {
    missing.push(rel)
  }
}

if (missing.length) {
  console.error('docs smoke failed — missing pages:')
  for (const m of missing) console.error(`  - ${m}`)
  process.exit(1)
}

console.log(`docs smoke ok — ${required.length} pages present in ${dist}`)
