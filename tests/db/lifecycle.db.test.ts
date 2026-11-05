/** Cascades on user deletion and the updated_at trigger the quiz's incremental download depends on. */
import { expect } from 'expect';

import { adminClient, createTestUser, deleteTestUser, QA_MARKER, uuid } from '../../src/support/supabase.js';

describe('DB · Cascades and triggers', () => {
  after(async () => {
    await adminClient().from('quiz_questions').delete().like('id', 'qa-trg-%');
    await adminClient().from('quiz_reports').delete().like('note', `${QA_MARKER}%`);
  });

  it('[DB-CAS-001] deleting a user deletes their places, trips, documents, profile and suggestions', async () => {
    const user = await createTestUser('cascade');
    const now = Date.now();
    const c = user.client;
    await c.from('user_places').insert({ user_id: user.id, key: 'country:FR', status: 'visited', updated_at: now });
    await c.from('trips').insert({ id: uuid(), user_id: user.id, from_iata: 'MAD', to_iata: 'BCN', created_at: now, updated_at: now });
    await c.from('user_docs').insert({ user_id: user.id, doc_type: 'quiz', doc_id: 'progress', data: {}, updated_at: now });
    await c.from('profiles').upsert({ id: user.id, display_name: 'Cascade', updated_at: now });
    await c.from('quiz_suggestions').insert({ cc: 'WORLD', question: `${QA_MARKER} cascade?`, answer: 'Yes' });

    const admin = adminClient();
    const counts = async () => {
      const out: Record<string, number> = {};
      for (const [table, col] of [['user_places', 'user_id'], ['trips', 'user_id'], ['user_docs', 'user_id'], ['profiles', 'id'], ['quiz_suggestions', 'user_id']]) {
        const { count } = await admin.from(table).select('*', { count: 'exact', head: true }).eq(col, user.id);
        out[table] = count ?? -1;
      }
      return out;
    };
    expect(await counts()).toEqual({ user_places: 1, trips: 1, user_docs: 1, profiles: 1, quiz_suggestions: 1 });
    await deleteTestUser(user);
    expect(await counts()).toEqual({ user_places: 0, trips: 0, user_docs: 0, profiles: 0, quiz_suggestions: 0 });
  });

  it('[DB-CAS-002] deleting a user keeps their question reports but removes the link to them', async () => {
    const user = await createTestUser('cascade-report');
    const { data: q } = await user.client.from('quiz_questions').select('id').limit(1);
    const note = `${QA_MARKER} cascade report ${Date.now()}`;
    await user.client.from('quiz_reports').insert({ question_id: q![0].id, reason: 'typo', note, user_id: user.id });
    await deleteTestUser(user);
    const { data } = await adminClient().from('quiz_reports').select('user_id').eq('note', note);
    expect(data).toEqual([{ user_id: null }]);
  });

  it('[DB-TRG-001] changing a quiz question bumps its updated_at, so apps download the change', async () => {
    const admin = adminClient();
    const id = `qa-trg-${uuid()}`;
    const { data: created } = await admin
      .from('quiz_questions')
      .insert({ id, cc: 'WORLD', category: 'geography', question: `${QA_MARKER} trigger?`, options: ['a', 'b', 'c', 'd'], answer: 0, explanation: 'x', active: false })
      .select('updated_at')
      .single();
    await new Promise((r) => setTimeout(r, 1100));
    const { data: updated } = await admin.from('quiz_questions').update({ explanation: 'changed' }).eq('id', id).select('updated_at').single();
    expect(Date.parse(updated!.updated_at)).toBeGreaterThan(Date.parse(created!.updated_at));
  });
});
