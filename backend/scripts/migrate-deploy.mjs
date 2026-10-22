import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const direct =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL;

if (!direct) {
  console.log('No database URL set; skipping prisma migrate deploy');
  process.exit(0);
}

const prismaCli = path.join(root, 'node_modules', 'prisma', 'build', 'index.js');
const result = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: direct },
});

process.exit(result.status ?? 1);
