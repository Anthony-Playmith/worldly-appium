/**
 * Database rules (CHECK constraints, column limits, foreign keys) that protect data no matter which
 * client writes it. Each invalid write must be refused by Postgres; each valid one accepted.
 */
import { expect } from 'expect';

import { adminClient, createTestUser, deleteTestUser, QA_MARKER, type TestUser, uuid } from '../../src/support/supabase.js';

const CHECK_VIOLATION = '23514';
const TOO_LONG = '22001';

describe('DB · Constraints', () => {
  let user: TestUser;
  const now = () => Date.now();
  const place = (key: string, status: string | null = 'visited') => ({ user_id: user.id, key, status, updated_at: now() });
  const trip = (patch: Record<string, unknown>) => ({ id: uuid(), user_id: user.id, from_iata: 'JFK', to_iata: 'LHR', created_at: now(), updated_at: now(), ...patch });

  before(async () => {
    user = await createTestUser('db');
  });
  after(async () => {
    await adminClient().from('quiz_questions').delete().like('id', 'qa-db-%');
    await adminClient().from('quiz_reports').delete().like('note', `${QA_MARKER}%`);
    await deleteTestUser(user);
  });

  it('[DB-CON-001] place keys must be <country|region|city|airport|unesco>:<code>', async () => {
    for (const key of ['country:FR', 'region:US-CA', 'city:2988507', 'airport:JFK', 'unesco:274']) {
      const { error } = await user.client.from('user_places').insert(place(key));
      expect({ key, error }).toEqual({ key, error: null });
    }
    for (const key of ['planet:MARS', 'FR', 'country:', 'Country:FR']) {
      const { error } = await user.client.from('user_places').insert(place(key));
      expect({ key, code: error?.code }).toEqual({ key, code: CHECK_VIOLATION });
    }
  });

  it('[DB-CON-002] a place status is visited, want, or null (removed)', async () => {
    expect((await user.client.from('user_places').insert(place('country:ES', 'want'))).error).toBeNull();
    expect((await user.client.from('user_places').insert(place('country:PT', null))).error).toBeNull();
    expect((await user.client.from('user_places').insert(place('country:IT', 'maybe'))).error?.code).toBe(CHECK_VIOLATION);
  });

  it('[DB-CON-003] trip times must be HH:MM', async () => {
    expect((await user.client.from('trips').insert(trip({ depart_time: '09:05', arrive_time: '23:59' }))).error).toBeNull();
    for (const t of ['9:05', '0905', '09:5', 'noon']) {
      const { error } = await user.client.from('trips').insert(trip({ depart_time: t }));
      expect({ t, code: error?.code }).toEqual({ t, code: CHECK_VIOLATION });
    }
  });

  it('[DB-CON-004] trip cabin class is economy, premium_economy, business or first', async () => {
    for (const c of ['economy', 'premium_economy', 'business', 'first']) {
      expect((await user.client.from('trips').insert(trip({ cabin_class: c }))).error).toBeNull();
    }
    expect((await user.client.from('trips').insert(trip({ cabin_class: 'luxury' }))).error?.code).toBe(CHECK_VIOLATION);
  });

  it('[DB-CON-005] trip text limits: flight number ≤ 10, seat ≤ 8, notes ≤ 1000, airports 3 letters', async () => {
    expect((await user.client.from('trips').insert(trip({ flight_number: 'AB12345678', seat: '12ABCDEF', notes: 'x'.repeat(1000) }))).error).toBeNull();
    expect((await user.client.from('trips').insert(trip({ flight_number: 'AB123456789' }))).error?.code).toBe(CHECK_VIOLATION);
    expect((await user.client.from('trips').insert(trip({ seat: '123456789' }))).error?.code).toBe(CHECK_VIOLATION);
    expect((await user.client.from('trips').insert(trip({ notes: 'x'.repeat(1001) }))).error?.code).toBe(CHECK_VIOLATION);
    expect((await user.client.from('trips').insert(trip({ from_iata: 'JFKX' }))).error?.code).toBe(TOO_LONG);
  });

  it('[DB-CON-006] profile: name ≤ 20 characters, theme and country count from the allowed lists', async () => {
    const base = { id: user.id, updated_at: now() };
    expect((await user.client.from('profiles').upsert({ ...base, display_name: 'x'.repeat(20), theme: 'dark', count_mode: '197' })).error).toBeNull();
    expect((await user.client.from('profiles').upsert({ ...base, display_name: 'x'.repeat(21) })).error?.code).toBe(TOO_LONG);
    expect((await user.client.from('profiles').upsert({ ...base, theme: 'sepia' })).error?.code).toBe(CHECK_VIOLATION);
    expect((await user.client.from('profiles').upsert({ ...base, count_mode: '200' })).error?.code).toBe(CHECK_VIOLATION);
  });

  it('[DB-CON-007] synced documents are only cost groups or quiz progress', async () => {
    const doc = (doc_type: string) => ({ user_id: user.id, doc_type, doc_id: uuid(), data: {}, updated_at: now() });
    expect((await user.client.from('user_docs').insert(doc('cost_group'))).error).toBeNull();
    expect((await user.client.from('user_docs').insert(doc('quiz'))).error).toBeNull();
    expect((await user.client.from('user_docs').insert(doc('photos'))).error?.code).toBe(CHECK_VIOLATION);
  });

  it('[DB-CON-008] question reports: reason from the list, note ≤ 300 characters', async () => {
    const { data } = await user.client.from('quiz_questions').select('id').limit(1);
    const report = (patch: Record<string, unknown>) => ({ question_id: data![0].id, reason: 'other', note: `${QA_MARKER} db`, ...patch });
    expect((await user.client.from('quiz_reports').insert(report({}))).error).toBeNull();
    expect((await user.client.from('quiz_reports').insert(report({ reason: 'spam' }))).error?.code).toBe(CHECK_VIOLATION);
    expect((await user.client.from('quiz_reports').insert(report({ note: `${QA_MARKER} ${'x'.repeat(300)}` }))).error?.code).toBe(CHECK_VIOLATION);
  });

  it('[DB-CON-009] question suggestions: question 5–300 characters, answer 1–150', async () => {
    const s = (question: string, answer: string) => ({ cc: 'WORLD', question, answer });
    expect((await user.client.from('quiz_suggestions').insert(s(`${QA_MARKER} ok?`, 'Yes'))).error).toBeNull();
    expect((await user.client.from('quiz_suggestions').insert(s('Hi?', 'Yes'))).error?.code).toBe(CHECK_VIOLATION);
    expect((await user.client.from('quiz_suggestions').insert(s(`${QA_MARKER} ${'x'.repeat(300)}`, 'Yes'))).error?.code).toBe(CHECK_VIOLATION);
    expect((await user.client.from('quiz_suggestions').insert(s(`${QA_MARKER} empty answer?`, ''))).error?.code).toBe(CHECK_VIOLATION);
    await adminClient().from('quiz_suggestions').delete().eq('user_id', user.id);
  });

  it('[DB-CON-010] quiz questions need exactly 4 options, an answer index 0–3 and a known category', async () => {
    const admin = adminClient();
    const q = (patch: Record<string, unknown>) => ({
      id: `qa-db-${uuid()}`, cc: 'WORLD', category: 'geography', question: `${QA_MARKER} test question?`,
      options: ['a', 'b', 'c', 'd'], answer: 0, explanation: 'x', active: false, ...patch,
    });
    expect((await admin.from('quiz_questions').insert(q({}))).error).toBeNull();
    expect((await admin.from('quiz_questions').insert(q({ options: ['a', 'b', 'c'] }))).error?.code).toBe(CHECK_VIOLATION);
    expect((await admin.from('quiz_questions').insert(q({ options: { a: 1 } }))).error?.code).toBe(CHECK_VIOLATION);
    expect((await admin.from('quiz_questions').insert(q({ answer: 4 }))).error?.code).toBe(CHECK_VIOLATION);
    expect((await admin.from('quiz_questions').insert(q({ category: 'sports' }))).error?.code).toBe(CHECK_VIOLATION);
  });
});
