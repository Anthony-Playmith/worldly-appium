/**
 * The app syncs with Supabase directly (PostgREST): upserts keyed on user + id with client
 * millisecond timestamps for last-write-wins, and pulls rows with updated_at > its cursor.
 * These tests replay those exact calls as two different users.
 */
import { expect } from 'expect';

import { createTestUser, deleteTestUser, type TestUser, uuid } from '../../src/support/supabase.js';

describe('API · Cloud sync (places, trips, documents, profile)', () => {
  let a: TestUser;
  let b: TestUser;
  const tripId = uuid();

  before(async () => {
    [a, b] = await Promise.all([createTestUser('sync-a'), createTestUser('sync-b')]);
  });
  after(async () => {
    await Promise.all([deleteTestUser(a), deleteTestUser(b)]);
  });

  it('[API-SYNC-001] place marks round-trip (upsert on user_id,key)', async () => {
    const now = Date.now();
    const rows = [
      { user_id: a.id, key: 'country:FR', status: 'visited', visit_date: '2026-05-01', updated_at: now },
      { user_id: a.id, key: 'country:JP', status: 'want', visit_date: null, updated_at: now },
      { user_id: a.id, key: 'unesco:274', status: 'visited', visit_date: null, updated_at: now },
    ];
    const { error } = await a.client.from('user_places').upsert(rows, { onConflict: 'user_id,key' });
    expect(error).toBeNull();
    const { data } = await a.client.from('user_places').select('key, status, visit_date, updated_at').order('key');
    expect(data).toEqual(
      rows.map(({ key, status, visit_date, updated_at }) => ({ key, status, visit_date, updated_at })).sort((x, y) => x.key.localeCompare(y.key)),
    );
  });

  it('[API-SYNC-002] saving the same place again updates it instead of duplicating (last write wins, removal = null status)', async () => {
    const later = Date.now() + 1000;
    await a.client.from('user_places').upsert({ user_id: a.id, key: 'country:JP', status: null, visit_date: null, updated_at: later }, { onConflict: 'user_id,key' });
    const { data } = await a.client.from('user_places').select('status, updated_at').eq('key', 'country:JP');
    expect(data).toEqual([{ status: null, updated_at: later }]);
  });

  it('[API-SYNC-003] trips round-trip with all fields', async () => {
    const now = Date.now();
    const trip = {
      id: tripId, user_id: a.id, flight_number: 'BA112', airline: 'British Airways', from_iata: 'JFK', to_iata: 'LHR',
      trip_date: '2026-06-01', depart_time: '18:30', arrive_time: '06:40', seat: '12A', cabin_class: 'business',
      notes: 'Window seat', deleted: false, created_at: now, updated_at: now,
    };
    const { error } = await a.client.from('trips').upsert(trip, { onConflict: 'id' });
    expect(error).toBeNull();
    const { data } = await a.client.from('trips').select('*').eq('id', tripId).single();
    expect(data).toEqual(trip);
  });

  it('[API-SYNC-004] deleting a trip is a tombstone (deleted=true) that syncs', async () => {
    const later = Date.now() + 2000;
    await a.client.from('trips').update({ deleted: true, updated_at: later }).eq('id', tripId);
    const { data } = await a.client.from('trips').select('deleted, updated_at').eq('id', tripId).single();
    expect(data).toEqual({ deleted: true, updated_at: later });
  });

  it('[API-SYNC-005] cost groups and quiz progress round-trip as JSON documents', async () => {
    const now = Date.now();
    const group = { id: uuid(), name: 'QA trip', currency: 'USD', members: [{ id: 'm1', name: 'Ana' }], expenses: [], settlements: [], budget: 500, tripIds: [], updatedAt: now };
    const quiz = { seen: { JP: ['q1'] }, stats: { answered: 3, correct: 2, streak: 1, bestStreak: 2, byCountry: {} }, daily: { date: '2026-11-05', count: 3 }, updatedAt: now };
    const { error } = await a.client.from('user_docs').upsert(
      [
        { user_id: a.id, doc_type: 'cost_group', doc_id: group.id, data: group, updated_at: now },
        { user_id: a.id, doc_type: 'quiz', doc_id: 'progress', data: quiz, updated_at: now },
      ],
      { onConflict: 'user_id,doc_type,doc_id' },
    );
    expect(error).toBeNull();
    const { data } = await a.client.from('user_docs').select('doc_type, data').order('doc_type');
    expect(data).toEqual([{ doc_type: 'cost_group', data: group }, { doc_type: 'quiz', data: quiz }]);
  });

  it('[API-SYNC-006] the profile (name and preferences) round-trips', async () => {
    const profile = { id: a.id, display_name: 'QA Tester', language: 'es', theme: 'dark', map_theme: 'ocean', count_mode: '197', updated_at: Date.now() };
    const { error } = await a.client.from('profiles').upsert(profile);
    expect(error).toBeNull();
    const { data } = await a.client.from('profiles').select('*').eq('id', a.id).maybeSingle();
    expect(data).toEqual(profile);
  });

  it('[API-SYNC-007] a pull with the cursor returns only rows changed after it', async () => {
    const { data: all } = await a.client.from('user_places').select('key, updated_at').order('updated_at');
    const cursor = all![0].updated_at;
    const { data } = await a.client.from('user_places').select('key').gt('updated_at', cursor).order('updated_at');
    expect(data!.map((r) => r.key)).toEqual(all!.filter((r) => r.updated_at > cursor).map((r) => r.key));
    expect(data!.length).toBeLessThan(all!.length);
  });

  it('[API-SYNC-008] another user cannot see any of the first user\'s data', async () => {
    for (const table of ['user_places', 'trips', 'user_docs', 'profiles']) {
      const { data, error } = await b.client.from(table).select('*');
      expect({ table, error, rows: data }).toEqual({ table, error: null, rows: [] });
    }
  });

  it('[API-SYNC-009] another user cannot write into or change the first user\'s data', async () => {
    const insert = await b.client.from('user_places').insert({ user_id: a.id, key: 'country:DE', status: 'visited', updated_at: Date.now() });
    expect(insert.error?.code).toBe('42501'); // RLS violation
    const update = await b.client.from('trips').update({ notes: 'tampered' }).eq('id', tripId).select();
    expect(update.data ?? []).toEqual([]);
    const del = await b.client.from('user_places').delete().eq('user_id', a.id).select();
    expect(del.data ?? []).toEqual([]);
    const { data } = await a.client.from('user_places').select('key');
    expect(data!.length).toBe(3);
  });
});
