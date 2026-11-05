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
const decode = (s: string) =>
  s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

if (existsSync(dir)) {
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.xml'))) {
    const xml = readFileSync(path.join(dir, file), 'utf8');
    for (const m of xml.matchAll(/<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g)) {
      const attrs = m[1];
      const name = decode(attrs.match(/\bname="([^"]*)"/)?.[1] ?? '');
      // Mocha keeps "[API-DEL-001] title"; the WebdriverIO JUnit reporter strips punctuation: "UI LAU 001 title"
      const m1 = name.match(/\[([A-Z]+-[A-Z]+-\d{3})\]/) ?? name.match(/^(UI|API|DB) ([A-Z]+) (\d{3})\b/);
      const id = m1 ? (m1.length > 2 ? `${m1[1]}-${m1[2]}-${m1[3]}` : m1[1]) : undefined;
      if (!id) continue;
      const body = m[3] ?? '';
      const tag = body.match(/<(failure|error)\b([^>]*)>([\s\S]*?)<\/\1>|<(failure|error)\b([^>]*)\/>/);
      // The element body has the full error (with Expected / Received); the message attribute only its first line
      const fullText = tag ? (tag[3] ?? '').replace(/<!\[CDATA\[|\]\]>/g, '').trim() || ((tag[2] ?? tag[5] ?? '').match(/\bmessage="([^"]*)"/)?.[1] ?? '') : '';
      results.push({
        id,
        title: name.replace(/^.*?\]\s*/, '').replace(/^(UI|API|DB) [A-Z]+ \d{3}\s*/, ''),
        status: tag ? 'failed' : /<skipped/.test(body) ? 'skipped' : 'passed',
        seconds: Number(attrs.match(/\btime="([^"]*)"/)?.[1] ?? 0),
        message: tag ? decode(fullText).split(/\n\s*at /)[0].replace(/^Error: /, '').replace(/\s+/g, ' ').trim().slice(0, 300) : '',
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
