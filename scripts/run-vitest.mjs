#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const vitestBin = require.resolve('vitest/vitest.mjs');

const sanitizedArgs = [];
let removedRunInBand = false;

for (const arg of process.argv.slice(2)) {
  if (arg === '--runInBand') {
    removedRunInBand = true;
    continue;
  }
  sanitizedArgs.push(arg);
}

if (removedRunInBand) {
  console.warn('[vitest] Option --runInBand ignorée : utilisez une suite ciblée ou un watcher unique si vous avez besoin de sérialiser les tests.');
}

const child = spawn(process.execPath, [vitestBin, ...sanitizedArgs], {
  stdio: 'inherit'
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
