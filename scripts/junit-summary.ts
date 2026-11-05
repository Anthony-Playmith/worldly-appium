/**
 * Prints a Markdown table of all JUnit results in reports/junit (appended to the GitHub Actions
 * job summary in CI) and writes reports/results.json, which the Excel builder uses to fill in the
 * "last automated run" columns.
 */
import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { env } from '../config/env.js';

export type CaseResult = { id: string; title: string; status: 'passed' | 'failed' | 'skipped'; seconds: number; message: string };

const dir = path.join(env.root, 'reports', 'junit');
const results: CaseResult[] = [];
const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

if (existsSync(dir)) {
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.xml'))) {
    const xml = readFileSync(path.join(dir, file), 'utf8');
    for (const m of xml.matchAll(/<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g)) {
      const attrs = m[1];
      const name = decode(attrs.match(/\bname="([^"]*)"/)?.[1] ?? '');
      const id = name.match(/\[([A-Z]+-[A-Z]+-\d+)\]/)?.[1];
      if (!id) continue;
      const body = m[3] ?? '';
      const failure = body.match(/<(failure|error)\b[^>]*?(?:message="([^"]*)")?[^>]*>/);
      results.push({
        id,
        title: name.replace(/^.*?\]\s*/, ''),
        status: failure ? 'failed' : /<skipped/.test(body) ? 'skipped' : 'passed',
        seconds: Number(attrs.match(/\btime="([^"]*)"/)?.[1] ?? 0),
        message: failure ? decode(failure[2] ?? '').split('\n')[0].slice(0, 300) : '',
      });
    }
  }
}

// A spec retried in CI reports the same test twice; keep the last result
const latest = new Map(results.map((r) => [r.id, r]));
const list = [...latest.values()].sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(path.join(env.root, 'reports', 'results.json'), JSON.stringify({ generatedAt: new Date().toISOString(), results: list }, null, 2));

const count = (s: CaseResult['status']) => list.filter((r) => r.status === s).length;
const icon = { passed: '✅', failed: '❌', skipped: '⏭️' };
const md = [
  `### Worldly tests: ${count('passed')} passed, ${count('failed')} failed, ${count('skipped')} skipped`,
  '',
  '| ID | Test | Result | Time | Details |',
  '|---|---|---|---|---|',
  ...list.map((r) => `| ${r.id} | ${r.title.replace(/\|/g, '/')} | ${icon[r.status]} | ${r.seconds.toFixed(1)} s | ${r.message.replace(/\|/g, '/')} |`),
].join('\n');
console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`);
