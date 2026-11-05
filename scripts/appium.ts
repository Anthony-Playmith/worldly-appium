/**
 * Runs the project's Appium with drivers kept inside this repo (.appium), e.g.
 *   npm run appium -- driver install uiautomator2
 *   npm run appium            # starts the server on port 4723
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { env } from '../config/env.js';

const bin = path.join(env.root, 'node_modules', '.bin', process.platform === 'win32' ? 'appium.cmd' : 'appium');
const args = process.argv.slice(2);
const res = spawnSync(bin, args.length ? args : ['--port', '4723'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, APPIUM_HOME: process.env.APPIUM_HOME ?? path.join(env.root, '.appium') },
});
process.exit(res.status ?? 1);
