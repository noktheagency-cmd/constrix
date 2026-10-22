import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const direct =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL;

if (!direct) {
  console.log('No database URL set; skipping demo seed');
  process.exit(0);
}

const prisma = new PrismaClient({ datasources: { db: { url: direct } } });
const [projects, acts] = await Promise.all([
  prisma.project.count({ where: { id: { startsWith: 'seed-' } } }),
  prisma.purchaseAct.count({ where: { id: 'seed-pa-1' } }),
]);
await prisma.$disconnect();

if (projects >= 10 && acts > 0) {
  console.log(`Demo data already loaded (${projects} projects)`);
  process.exit(0);
}

const result = spawnSync(process.execPath, [path.join(root, 'prisma', 'seed.mjs')], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: direct },
});

process.exit(result.status ?? 1);
