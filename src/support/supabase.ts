/**
 * Supabase helpers for API, database and cross-layer UI tests. Every user created here is a
 * throwaway (email prefix QA_EMAIL_PREFIX, created already confirmed so no email is sent) and is
 * deleted after the test; stale ones from crashed runs are swept by cleanupStaleTestUsers().
 */
import { randomBytes, randomUUID } from 'node:crypto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env, requireEnv } from '../../config/env.js';

export const QA_EMAIL_PREFIX = 'qa-automation+';
export const QA_EMAIL_DOMAIN = 'getworldly.app';
/** Marker put in free-text fields (reports, suggestions) written by tests, for cleanup and filtering. */
export const QA_MARKER = '[qa-automation]';

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

export function anonClient(): SupabaseClient {
  requireEnv('supabaseUrl', 'supabaseAnonKey');
  return createClient(env.supabaseUrl, env.supabaseAnonKey, options);
}

let admin: SupabaseClient | null = null;
/** Service-role client: bypasses Row Level Security. Only for setup, teardown and verification. */
export function adminClient(): SupabaseClient {
  requireEnv('supabaseUrl', 'supabaseSecretKey');
  admin ??= createClient(env.supabaseUrl, env.supabaseSecretKey, options);
  return admin;
}

export type TestUser = { id: string; email: string; password: string; client: SupabaseClient; accessToken: string };

/** Creates a confirmed throwaway user and returns a client signed in as that user. */
export async function createTestUser(label = 'user'): Promise<TestUser> {
  const email = `${QA_EMAIL_PREFIX}${label}-${Date.now()}-${randomBytes(3).toString('hex')}@${QA_EMAIL_DOMAIN}`;
  const password = `Qa!${randomBytes(9).toString('base64url')}`;
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { qa_automation: true },
  });
  if (error || !data.user) throw new Error(`Could not create test user: ${error?.message}`);
  const client = anonClient();
  const { data: signIn, error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError || !signIn.session) throw new Error(`Could not sign in test user: ${signInError?.message}`);
  return { id: data.user.id, email, password, client, accessToken: signIn.session.access_token };
}

export async function deleteTestUser(user: { id: string } | null | undefined) {
  if (!user) return;
  const { error } = await adminClient().auth.admin.deleteUser(user.id);
  if (error && !/not found/i.test(error.message)) throw error;
}

export async function userExists(id: string): Promise<boolean> {
  const { data, error } = await adminClient().auth.admin.getUserById(id);
  if (error && /not found/i.test(error.message)) return false;
  if (error) throw error;
  return Boolean(data.user);
}

/** Deletes leftover test users (from crashed runs) older than `minutes`. */
export async function cleanupStaleTestUsers(minutes = 60) {
  const cutoff = Date.now() - minutes * 60_000;
  for (let page = 1; page < 50; page++) {
    const { data, error } = await adminClient().auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) {
      if (u.email?.startsWith(QA_EMAIL_PREFIX) && new Date(u.created_at).getTime() < cutoff) await deleteTestUser(u);
    }
    if (data.users.length < 1000) break;
  }
}

/** Polls until `check` returns a truthy value or the timeout passes (sync is debounced in the app). */
export async function eventually<T>(check: () => Promise<T | null | undefined | false>, timeoutMs = 30_000, intervalMs = 1500): Promise<T> {
  const end = Date.now() + timeoutMs;
  let last: unknown;
  while (Date.now() < end) {
    try {
      const v = await check();
      if (v) return v;
    } catch (e) {
      last = e;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Condition not met within ${timeoutMs} ms${last ? `: ${(last as Error).message}` : ''}`);
}

export const uuid = () => randomUUID();
/** Client-style ms-epoch timestamp used by the app's last-write-wins sync. */
export const nowMs = () => Date.now();

/** Looks up the question shown on screen, so UI tests can answer right or wrong on purpose. */
export async function findQuestionByText(text: string) {
  const { data, error } = await anonClient().from('quiz_questions').select('*').eq('question', text).eq('active', true).limit(1);
  if (error) throw error;
  return (data?.[0] ?? null) as null | { id: string; cc: string; options: string[]; answer: number; explanation: string };
}
