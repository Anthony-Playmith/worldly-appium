/** Content quality of the live quiz bank that every app downloads. */
import { expect } from 'expect';

import { getEntities } from '../../src/support/strings.js';
import { anonClient } from '../../src/support/supabase.js';

type Question = { id: string; cc: string; category: string; question: string; options: string[]; answer: number; explanation: string };

/** Smallest bank per country (the tiers go from ~100 for big countries down to 30–50 for micro-states). */
const MIN_PER_COUNTRY = 30;
const MIN_WORLDWIDE = 100;

describe('DB · Quiz bank content', () => {
  let bank: Question[] = [];

  before(async () => {
    const client = anonClient();
    for (let from = 0; ; from += 1000) {
      const { data, error } = await client
        .from('quiz_questions')
        .select('id, cc, category, question, options, answer, explanation')
        .eq('active', true)
        .order('id')
        .range(from, from + 999);
      if (error) throw error;
      bank.push(...(data as Question[]));
      if (data.length < 1000) break;
    }
  });

  const problems = (check: (q: Question) => boolean) => bank.filter((q) => !check(q)).slice(0, 10).map((q) => q.id);

  it('[DB-DAT-001] every question has 4 different, non-empty options', () => {
    expect(problems((q) => q.options.length === 4 && q.options.every((o) => o.trim()) && new Set(q.options.map((o) => o.trim().toLowerCase())).size === 4)).toEqual([]);
  });

  it('[DB-DAT-002] every question has a valid answer index and an explanation', () => {
    expect(problems((q) => Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3 && q.explanation.trim().length > 0)).toEqual([]);
  });

  it('[DB-DAT-003] every question belongs to Worldwide or to one of the app\'s 197 countries', () => {
    const codes = new Set(getEntities().filter((e) => e.kind === 'country').map((e) => e.code));
    expect(problems((q) => q.cc === 'WORLD' || codes.has(q.cc))).toEqual([]);
  });

  it(`[DB-DAT-004] every one of the 197 countries has at least ${MIN_PER_COUNTRY} questions and Worldwide at least ${MIN_WORLDWIDE}`, () => {
    const count = new Map<string, number>();
    for (const q of bank) count.set(q.cc, (count.get(q.cc) ?? 0) + 1);
    const short = getEntities()
      .filter((e) => e.kind === 'country' && (count.get(e.code) ?? 0) < MIN_PER_COUNTRY)
      .map((e) => `${e.code}:${count.get(e.code) ?? 0}`);
    expect(short).toEqual([]);
    expect(count.get('WORLD') ?? 0).toBeGreaterThanOrEqual(MIN_WORLDWIDE);
  });

  it('[DB-DAT-005] no country repeats the same question', () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const q of bank) {
      const key = `${q.cc}|${q.question.trim().toLowerCase()}`;
      if (seen.has(key)) dupes.push(`${seen.get(key)} = ${q.id}`);
      else seen.set(key, q.id);
    }
    expect(dupes.slice(0, 10)).toEqual([]);
  });

  it('[DB-DAT-006] questions are well-formed: end with "?", 10–200 characters, explanation under 300', () => {
    expect(problems((q) => /\?\s*$/.test(q.question) && q.question.length >= 10 && q.question.length <= 200 && q.explanation.length < 300)).toEqual([]);
  });

  it('[DB-DAT-007] all four categories are used (history, geography, politics, culture)', () => {
    expect([...new Set(bank.map((q) => q.category))].sort()).toEqual(['culture', 'geography', 'history', 'politics']);
  });
});
