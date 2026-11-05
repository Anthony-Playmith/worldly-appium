/** Runs the API/database tests and then the UI tests (even if the first fail), then prints the summary. */
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';

import { env } from '../config/env.js';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const run = (...args: string[]) => spawnSync(npm, ['run', ...args], { stdio: 'inherit', cwd: env.root, shell: process.platform === 'win32' }).status ?? 1;

rmSync(path.join(env.root, 'reports', 'junit'), { recursive: true, force: true });
rmSync(path.join(env.root, 'reports', 'screenshots'), { recursive: true, force: true });
const backend = run('test:backend');
const ui = process.argv.includes('--backend-only') ? 0 : run('test:ui');
run('report:summary');
process.exit(backend || ui ? 1 : 0);
