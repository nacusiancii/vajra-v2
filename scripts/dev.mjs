#!/usr/bin/env node
/** electron-vite dev, with the Chromium sandbox off on Linux. */
import { spawn } from 'node:child_process'

if (process.platform === 'linux') {
  process.env.ELECTRON_DISABLE_SANDBOX = '1'
}

const child = spawn('electron-vite', ['dev', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true
})
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 1)
})
