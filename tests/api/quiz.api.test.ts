import { expect } from 'expect';

import { adminClient, anonClient, createTestUser, deleteTestUser, QA_MARKER, type TestUser } from '../../src/support/supabase.js';

const PAGE = 1000;

describe('API · Quiz bank, reports and suggestions', () => {
  let user: TestUser;
  let other: TestUser;
  let sampleId = '';

  before(async () => {
    [user, other] = await Promise.all([createTestUser('quiz'), createTestUser('quiz-other')]);
    const { data } = await anonClient().from('quiz_questions').select('id').eq('active', true).limit(1);
    sampleId = data![0].id;
  });
  after(async () => {
    const admin = adminClient();
    await admin.from('quiz_reports').delete().like('note', `${QA_MARKER}%`);
    await admin.from('quiz_suggestions').delete().like('question', `${QA_MARKER}%`);
    await Promise.all([deleteTestUser(user), deleteTestUser(other)]);
  });

  it('[API-QUIZ-001] anyone (signed out) can read the question bank and it is not empty', async () => {
    const { count, error } = await anonClient().from('quiz_questions').select('id', { count: 'exact', head: true }).eq('active', true);
    expect(error).toBeNull();
    expect(count).toBeGreaterThan(10_000);
  });

  it('[API-QUIZ-002] the bank downloads in pages of 1000 ordered by updated_at, like the app does', async () => {
    const client = anonClient();
    const first = await client.from('quiz_questions').select('id, updated_at').order('updated_at').range(0, PAGE - 1);
    const second = await client.from('quiz_questions').select('id, updated_at').order('updated_at').range(PAGE, 2 * PAGE - 1);
    expect(first.error).toBeNull();
    expect(first.data).toHaveLength(PAGE);
    expect(second.data!.length).toBeGreaterThan(0);
    const times = [...first.data!, ...second.data!].map((r) => Date.parse(r.updated_at));
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('[API-QUIZ-003] an incremental sync after the newest updated_at returns nothing', async () => {
    const client = anonClient();
    const { data: newest } = await client.from('quiz_questions').select('updated_at').order('updated_at', { ascending: false }).limit(1);
    const { data, error } = await client.from('quiz_questions').select('id').gt('updated_at', newest![0].updated_at);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('[API-QUIZ-004] the app\'s users cannot add, change or delete questions', async () => {
    for (const client of [anonClient(), user.client]) {
      const insert = await client.from('quiz_questions').insert({
        id: `qa-forbidden-${Date.now()}`, cc: 'WORLD', category: 'geography', question: `${QA_MARKER} forbidden?`,
        options: ['a', 'b', 'c', 'd'], answer: 0, explanation: 'x', active: false,
      });
      expect(insert.error).not.toBeNull();
      const update = await client.from('quiz_questions').update({ explanation: 'hacked' }).eq('id', sampleId).select();
      expect(update.data ?? []).toEqual([]);
      const del = await client.from('quiz_questions').delete().eq('id', sampleId).select();
      expect(del.data ?? []).toEqual([]);
    }
    const { data } = await anonClient().from('quiz_questions').select('id, explanation').eq('id', sampleId).single();
    expect(data?.explanation).not.toBe('hacked');
  });

  it('[API-QUIZ-005] anyone can report a question, but reports cannot be read back', async () => {
    const note = `${QA_MARKER} anon report ${Date.now()}`;
    const { error } = await anonClient().from('quiz_reports').insert({ question_id: sampleId, reason: 'unclear', note });
    expect(error).toBeNull();
    const readBack = await anonClient().from('quiz_reports').select('*').eq('note', note);
    expect(readBack.data ?? []).toEqual([]);
    const { data: stored } = await adminClient().from('quiz_reports').select('question_id, reason, user_id').eq('note', note);
    expect(stored).toEqual([{ question_id: sampleId, reason: 'unclear', user_id: null }]);
  });

  it('[API-QUIZ-006] a signed-in user can report as themselves but not as someone else', async () => {
    const own = await user.client.from('quiz_reports').insert({ question_id: sampleId, reason: 'typo', note: `${QA_MARKER} own`, user_id: user.id });
    expect(own.error).toBeNull();
    const spoofed = await user.client.from('quiz_reports').insert({ question_id: sampleId, reason: 'typo', note: `${QA_MARKER} spoof`, user_id: other.id });
    expect(spoofed.error).not.toBeNull();
  });

  it('[API-QUIZ-007] a report for a question that does not exist is rejected', async () => {
    const { error } = await anonClient().from('quiz_reports').insert({ question_id: 'no-such-question', reason: 'wrong', note: `${QA_MARKER} fk` });
    expect(error?.code).toBe('23503'); // foreign key violation
  });

  it('[API-QUIZ-008] only signed-in users can suggest questions, and they cannot read suggestions back', async () => {
    const row = { cc: 'JP', question: `${QA_MARKER} What is the capital of Japan?`, answer: 'Tokyo', explanation: 'Automated test' };
    const anon = await anonClient().from('quiz_suggestions').insert(row);
    expect(anon.error).not.toBeNull();
    const signedIn = await user.client.from('quiz_suggestions').insert(row);
    expect(signedIn.error).toBeNull();
    const { data: own } = await user.client.from('quiz_suggestions').select('*');
    expect(own ?? []).toEqual([]);
    const { data: stored } = await adminClient().from('quiz_suggestions').select('user_id, status').eq('question', row.question);
    expect(stored).toEqual([{ user_id: user.id, status: 'pending' }]);
  });

  it('[API-QUIZ-009] a suggestion cannot be filed in another user\'s name', async () => {
    const { error } = await user.client.from('quiz_suggestions').insert({ cc: 'WORLD', question: `${QA_MARKER} spoofed question?`, answer: 'x', user_id: other.id });
    expect(error).not.toBeNull();
  });
});
