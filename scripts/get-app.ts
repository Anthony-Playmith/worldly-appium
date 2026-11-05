/**
 * Downloads the newest finished Android build of Worldly from EAS into apps/worldly.apk.
 *
 *   npm run app:download                     # latest "preview" APK
 *   npm run app:download -- --profile production   # latest store build (AAB, converted to a universal APK)
 *
 * Needs an Expo login (`npx eas-cli login`) or EXPO_TOKEN. AAB conversion needs Java 17 (JAVA_HOME).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { env } from '../config/env.js';

const BUNDLETOOL_URL = 'https://github.com/google/bundletool/releases/download/1.18.1/bundletool-all-1.18.1.jar';
const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const profile = arg('profile', 'preview');
const out = path.resolve(env.root, arg('out', 'apps/worldly.apk'));
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

type Build = { id: string; buildProfile: string; createdAt: string; gitCommitHash?: string; appVersion?: string; artifacts: { buildUrl: string } };

function latestBuild(): Build {
  const res = spawnSync(
    npx,
    ['--yes', 'eas-cli@latest', 'build:list', '--platform', 'android', '--status', 'finished', '--build-profile', profile, '--limit', '1', '--json', '--non-interactive'],
    { cwd: path.join(env.root, 'eas-project'), encoding: 'utf8', shell: process.platform === 'win32' },
  );
  const json = res.stdout.slice(res.stdout.indexOf('['));
  if (res.status !== 0 || !json.startsWith('[')) throw new Error(`eas build:list failed (log in with "npx eas-cli login" or set EXPO_TOKEN):\n${res.stderr || res.stdout}`);
  const [build] = JSON.parse(json) as Build[];
  if (!build) throw new Error(`No finished Android "${profile}" build on EAS yet.`);
  return build;
}

async function download(url: string, file: string) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status}): ${url}`);
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(file));
}

function java() {
  const bin = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', 'java') : 'java';
  return bin;
}

async function aabToApk(aab: string, apk: string) {
  const jar = path.join(env.root, '.tools', 'bundletool.jar');
  if (!existsSync(jar)) {
    mkdirSync(path.dirname(jar), { recursive: true });
    console.log('Downloading bundletool...');
    await download(BUNDLETOOL_URL, jar);
  }
  // Signs the universal APK with the Android debug key (created if missing)
  const ks = path.join(homedir(), '.android', 'debug.keystore');
  if (!existsSync(ks)) {
    mkdirSync(path.dirname(ks), { recursive: true });
    const keytool = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', 'keytool') : 'keytool';
    execFileSync(keytool, ['-genkeypair', '-keystore', ks, '-storepass', 'android', '-alias', 'androiddebugkey', '-keypass', 'android', '-keyalg', 'RSA', '-validity', '10000', '-dname', 'CN=Android Debug,O=Android,C=US']);
  }
  const apks = `${apk}s`;
  execFileSync(java(), ['-jar', jar, 'build-apks', `--bundle=${aab}`, `--output=${apks}`, '--mode=universal', '--overwrite',
    `--ks=${ks}`, '--ks-pass=pass:android', '--ks-key-alias=androiddebugkey', '--key-pass=pass:android'], { stdio: 'inherit' });
  const tmp = path.join(path.dirname(apk), 'universal-extract');
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp);
  execFileSync('tar', ['-xf', apks, '-C', tmp, 'universal.apk']);
  renameSync(path.join(tmp, 'universal.apk'), apk);
  rmSync(tmp, { recursive: true, force: true });
  rmSync(apks, { force: true });
}

const build = latestBuild();
console.log(`Latest "${profile}" build: ${build.id} (${build.createdAt}, commit ${build.gitCommitHash?.slice(0, 7) ?? '?'})`);
mkdirSync(path.dirname(out), { recursive: true });
const url = build.artifacts.buildUrl;
if (url.endsWith('.aab')) {
  const aab = out.replace(/\.apk$/, '.aab');
  await download(url, aab);
  await aabToApk(aab, out);
} else {
  await download(url, out);
}
writeFileSync(path.join(path.dirname(out), 'build-info.json'), JSON.stringify({ ...build, downloadedAt: new Date().toISOString() }, null, 2));
console.log(`Saved ${path.relative(env.root, out)}`);
