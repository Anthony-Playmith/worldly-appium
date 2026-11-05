/**
 * The app's own translation files (copied into fixtures/app-data by `npm run sync:app-data`), so
 * selectors use exactly the text the app shows in whatever language the device runs.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { env } from '../../config/env.js';
import { regexLiteral } from './selectors.js';

type Dict = { [key: string]: string | Dict };

const dataDir = path.join(env.root, 'fixtures', 'app-data');
const readJson = <T>(file: string): T => JSON.parse(readFileSync(path.join(dataDir, file), 'utf8'));

export const SUPPORTED_LANGUAGES = [
  'en', 'es', 'pt', 'fr', 'de', 'it', 'nl', 'pl', 'ru', 'uk', 'tr', 'ar', 'hi', 'id', 'th', 'vi', 'ja', 'ko', 'zh-Hans', 'zh-Hant',
] as const;

const cache = new Map<string, Dict>();
const dict = (lang: string) => {
  if (!cache.has(lang)) cache.set(lang, readJson<Dict>(`locales/${lang}.json`));
  return cache.get(lang)!;
};

let current = 'en';

/** Maps a device locale such as "es-CR" or "zh-TW" to one of the app's languages, like the app does. */
export function resolveLanguage(locale: string): string {
  const [lang] = locale.split(/[-_]/);
  if (lang === 'zh') return /Hant|TW|HK|MO/i.test(locale) ? 'zh-Hant' : 'zh-Hans';
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(lang) ? lang : 'en';
}

export function setLanguage(lang: string) {
  current = (SUPPORTED_LANGUAGES as readonly string[]).includes(lang) ? lang : 'en';
}
export const language = () => current;

function lookup(d: Dict, key: string): string | undefined {
  const v = key.split('.').reduce<string | Dict | undefined>((node, part) => (typeof node === 'object' ? node[part] : undefined), d);
  return typeof v === 'string' ? v : undefined;
}

/** i18next-style lookup with {{param}} interpolation and English fallback (same as the app). */
export function t(key: string, params: Record<string, string | number> = {}): string {
  const raw = lookup(dict(current), key) ?? lookup(dict('en'), key);
  if (raw === undefined) throw new Error(`Unknown translation key: ${key}`);
  return raw.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, p: string) => (p in params ? String(params[p]) : `{{${p}}}`));
}

/** A translation as a regex: given params are matched literally, missing ones match any text. */
export function tPattern(key: string, params: Record<string, string | number> = {}): string {
  const raw = lookup(dict(current), key) ?? lookup(dict('en'), key);
  if (raw === undefined) throw new Error(`Unknown translation key: ${key}`);
  const lit = regexLiteral;
  return `^${raw
    .split(/(\{\{\s*\w+\s*\}\})/)
    .map((part) => {
      const m = part.match(/^\{\{\s*(\w+)\s*\}\}$/);
      if (!m) return lit(part);
      return m[1] in params ? lit(String(params[m[1]])) : '.+?';
    })
    .join('')}$`;
}

type Entity = { code: string; name: string; kind: 'country' | 'territory'; un195: boolean; continent: string; capital?: string; parent?: string };
let entities: Entity[] | null = null;
export const getEntities = () => (entities ??= readJson<Entity[]>('countries.json'));
export const getEntity = (code: string) => getEntities().find((e) => e.code === code);

let names: Record<string, Record<string, string>> | null = null;
/** Country name exactly as the app shows it in the current language. */
export function countryName(code: string): string {
  names ??= readJson('country-names.json');
  return names![current]?.[code] ?? getEntity(code)?.name ?? code;
}
