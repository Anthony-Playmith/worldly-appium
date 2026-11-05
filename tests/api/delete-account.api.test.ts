import { expect } from 'expect';

import { env } from '../../config/env.js';
import { adminClient, createTestUser, deleteTestUser, type TestUser, userExists, uuid } from '../../src/support/supabase.js';

const fnUrl = () => `${env.supabaseUrl}/functions/v1/delete-account`;
const call = (init: RequestInit = {}) =>
  fetch(fnUrl(), { method: 'POST', ...init, headers: { apikey: env.supabaseAnonKey, 'Content-Type': 'application/json', ...init.headers } });

describe('API · delete-account Edge Function', () => {
  let user: TestUser;

  before(async () => {
    user = await createTestUser('delete');
  });
  after(async () => {
    await deleteTestUser(user);
  });

  it('[API-DEL-001] answers the CORS preflight', async () => {
    const res = await fetch(fnUrl(), { method: 'OPTIONS' });
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('[API-DEL-002] rejects methods other than POST', async () => {
    const res = await call({ method: 'GET', headers: { Authorization: `Bearer ${user.accessToken}` } });
    expect(res.status).toBe(405);
  });

  it('[API-DEL-003] rejects a request without a user token', async () => {
    const res = await call();
    expect(res.status).toBe(401);
    expect(await userExists(user.id)).toBe(true);
  });

  it('[API-DEL-004] rejects a forged token', async () => {
    const res = await call({ headers: { Authorization: 'Bearer not-a-real-token' } });
    expect(res.status).toBe(401);
  });

  it('[API-DEL-005] deletes the caller\'s account together with all of their cloud data', async () => {
    const now = Date.now();
    await user.client.from('user_places').insert({ user_id: user.id, key: 'country:FR', status: 'visited', updated_at: now });
    await user.client.from('trips').insert({ id: uuid(), user_id: user.id, from_iata: 'JFK', to_iata: 'LHR', created_at: now, updated_at: now });
    await user.client.from('profiles').upsert({ id: user.id, display_name: 'Delete me', updated_at: now });

    const res = await call({ headers: { Authorization: `Bearer ${user.accessToken}` } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });

    expect(await userExists(user.id)).toBe(false);
    const admin = adminClient();
    for (const [table, column] of [['user_places', 'user_id'], ['trips', 'user_id'], ['profiles', 'id']] as const) {
      const { data } = await admin.from(table).select('*').eq(column, user.id);
      expect({ table, rows: data }).toEqual({ table, rows: [] });
    }
  });
});
