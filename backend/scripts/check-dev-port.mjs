import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { parseEnv } from 'node:util';

const envFile = new URL('../.env', import.meta.url);
const env = existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {};
const port = Number(process.env.PORT ?? env.PORT ?? 3001);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('[AFEZ] PORT must be an integer between 1 and 65535. Check backend/.env and your terminal environment.');
  process.exitCode = 1;
} else {
  // Probe the same wildcard address Nest uses, before starting either watcher.
  const probe = createServer();
  probe.once('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `[AFEZ] API port ${port} is already in use.\n` +
        'If AFEZ is already running, use its existing terminal and browser tab.\n' +
        'To restart it, press Ctrl+C in that terminal before running npm run dev again.\n' +
        'If another application owns the port, choose a free PORT in backend/.env.',
      );
    } else {
      console.error(`[AFEZ] Cannot listen on API port ${port}: ${error.message}`);
    }
    process.exitCode = 1;
  });
  probe.listen(port, () => probe.close());
}
