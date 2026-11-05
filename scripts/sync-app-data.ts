/**
 * Copies the app's translations and country data into fixtures/app-data so selectors match the
 * app's texts. Run after the app's texts change:  npm run sync:app-data -- ../worldly
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { env } from '../config/env.js';

const appDir = path.resolve(env.root, process.argv[2] ?? '../worldly');
const locales = path.join(appDir, 'src', 'i18n', 'locales');
const data = path.join(appDir, 'src', 'data', 'generated');
if (!existsSync(locales)) throw new Error(`Worldly app not found at ${appDir} (pass its folder as an argument)`);

const target = path.join(env.root, 'fixtures', 'app-data');
mkdirSync(path.join(target, 'locales'), { recursive: true });
let n = 0;
for (const f of readdirSync(locales).filter((f) => f.endsWith('.json'))) {
  copyFileSync(path.join(locales, f), path.join(target, 'locales', f));
  n++;
}
for (const f of ['countries.json', 'country-names.json']) copyFileSync(path.join(data, f), path.join(target, f));
console.log(`Copied ${n} locale files and country data from ${appDir}`);
