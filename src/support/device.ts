import { execFileSync } from 'node:child_process';

import { adbPath, env } from '../../config/env.js';

/** Runs an adb command against the configured device and returns its trimmed output. */
export function adb(...args: string[]): string {
  const target = env.deviceUdid ? ['-s', env.deviceUdid] : [];
  return execFileSync(adbPath(), [...target, ...args], { encoding: 'utf8', timeout: 120_000 }).trim();
}

export function connectedDevices(): string[] {
  return adb('devices')
    .split(/\r?\n/)
    .slice(1)
    .map((l) => l.split(/\s+/))
    .filter(([, state]) => state === 'device')
    .map(([serial]) => serial);
}

/** Device locale such as "en-US" or "es-CR". */
export function deviceLocale(): string {
  for (const prop of ['persist.sys.locale', 'ro.product.locale']) {
    const v = adb('shell', 'getprop', prop);
    if (v) return v;
  }
  return 'en-US';
}

export const isEmulator = () => adb('shell', 'getprop', 'ro.kernel.qemu') === '1' || adb('shell', 'getprop', 'ro.boot.qemu') === '1';

export const isInstalled =(appId: string) => adb('shell', 'pm', 'list', 'packages', appId).split(/\r?\n/).some((l) => l.trim() === `package:${appId}`);
