import { expect } from 'expect';

import { anonClient, createTestUser, deleteTestUser, QA_EMAIL_DOMAIN, type TestUser } from '../../src/support/supabase.js';

describe('API · Authentication (Supabase Auth)', () => {
  let user: TestUser;

  before(async () => {
    user = await createTestUser('auth');
  });
  after(async () => {
    await deleteTestUser(user);
  });

  it('[API-AUTH-001] email + password sign-in returns a session for that user', async () => {
    const { data, error } = await anonClient().auth.signInWithPassword({ email: user.email, password: user.password });
    expect(error).toBeNull();
    expect(data.session?.access_token).toBeTruthy();
    expect(data.user?.email).toBe(user.email);
    expect(data.user?.id).toBe(user.id);
  });

  it('[API-AUTH-002] a wrong password is rejected', async () => {
    const { data, error } = await anonClient().auth.signInWithPassword({ email: user.email, password: 'wrong-password-123' });
    expect(data.session).toBeNull();
    expect(error?.status).toBe(400);
    expect(error?.code).toBe('invalid_credentials');
  });

  it('[API-AUTH-003] an unknown email gets the same error (no account enumeration)', async () => {
    const { error } = await anonClient().auth.signInWithPassword({ email: `nobody-${Date.now()}@${QA_EMAIL_DOMAIN}`, password: 'whatever-123' });
    expect(error?.status).toBe(400);
    expect(error?.code).toBe('invalid_credentials');
  });

  it('[API-AUTH-004] the access token identifies the user (getUser)', async () => {
    const { data, error } = await user.client.auth.getUser();
    expect(error).toBeNull();
    expect(data.user?.id).toBe(user.id);
  });

  it('[API-AUTH-005] after sign-out the old session no longer reads private data', async () => {
    const temp = await createTestUser('signout');
    try {
      await temp.client.from('user_places').insert({ user_id: temp.id, key: 'country:FR', status: 'visited', updated_at: Date.now() });
      await temp.client.auth.signOut();
      const { data } = await temp.client.from('user_places').select('*');
      expect(data ?? []).toEqual([]);
    } finally {
      await deleteTestUser(temp);
    }
  });

  it('[API-AUTH-006] signed-out visitors see no rows in any private table', async () => {
    const anon = anonClient();
    for (const table of ['profiles', 'user_places', 'trips', 'user_docs', 'quiz_reports', 'quiz_suggestions']) {
      const { data, error } = await anon.from(table).select('*').limit(5);
      expect({ table, rows: error ? [] : data }).toEqual({ table, rows: [] });
    }
  });
});
