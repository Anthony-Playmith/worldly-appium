import 'dotenv/config';

import { existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const value = (name: string) => process.env[name]?.trim() || '';

export const APP_ID = 'app.getworldly';
export const APP_ACTIVITY = 'app.getworldly.MainActivity';

export const env = {
  root,
  supabaseUrl: value('SUPABASE_URL'),
  supabaseAnonKey: value('SUPABASE_ANON_KEY'),
  supabaseSecretKey: value('SUPABASE_SECRET_KEY'),
  androidHome: value('ANDROID_HOME') || value('ANDROID_SDK_ROOT'),
  appPath: value('APP_PATH') ? path.resolve(root, value('APP_PATH')) : '',
  deviceUdid: value('DEVICE_UDID'),
  appLanguage: value('APP_LANGUAGE'),
  /** UI specs wipe Worldly's data on the device; on a real phone this must be allowed explicitly. */
  allowAppDataReset: value('ALLOW_APP_DATA_RESET') === 'true',
  isCI: Boolean(process.env.CI),
};

/** Throws a readable error when a test needs settings that are missing from .env / CI secrets. */
export function requireEnv(...names: (keyof typeof env)[]) {
  const missing = names.filter((n) => !env[n]);
  if (missing.length) throw new Error(`Missing settings: ${missing.join(', ')}. Copy .env.example to .env and fill them in.`);
}

export const adbPath = () => {
  const exe = process.platform === 'win32' ? 'adb.exe' : 'adb';
  const fromSdk = env.androidHome ? path.join(env.androidHome, 'platform-tools', exe) : '';
  return fromSdk && existsSync(fromSdk) ? fromSdk : 'adb';
};
