/**
 * End-to-end across layers: actions in the app must reach Supabase, and data changed in Supabase
 * must reach the app. Uses a throwaway confirmed user created through the admin API.
 */
import { $, expect } from '@wdio/globals';

import { App } from '../../src/pages/App.js';
import { MapPage } from '../../src/pages/MapPage.js';
import { AuthPage, ProfilePage } from '../../src/pages/ProfilePages.js';
import { TabBar } from '../../src/pages/TabBar.js';
import { addFlight, FlightsPage, TravelPage } from '../../src/pages/TravelPages.js';
import { Alert, tap, waitFor, waitGone } from '../../src/pages/base.js';
import { markCountries } from '../../src/pages/flows.js';
import { t } from '../../src/support/strings.js';
import { adminClient, cleanupStaleTestUsers, createTestUser, deleteTestUser, eventually, type TestUser, userExists } from '../../src/support/supabase.js';

async function openSignIn() {
  await TabBar.open('profile');
  await ProfilePage.waitForShown();
  await ProfilePage.openSignIn();
  await AuthPage.waitForShown();
}

async function expectAlert(text: string) {
  const alert = await Alert.waitFor();
  expect([alert.title, alert.message]).toContain(text);
  await Alert.dismiss();
}

describe('Account and cloud sync (app ↔ Supabase)', () => {
  let user: TestUser;

  before(async () => {
    await cleanupStaleTestUsers();
    user = await createTestUser('ui');
    await App.reset();
  });

  after(async () => {
    await deleteTestUser(user);
  });

  it('[UI-ACC-001] the sign-in form rejects an invalid email or a short password', async () => {
    await openSignIn();
    await AuthPage.signIn('not-an-email', 'short');
    await expectAlert(t('auth.invalid'));
  });

  it('[UI-ACC-002] a wrong password shows an error and keeps the user signed out', async () => {
    await AuthPage.signIn(user.email, 'Wrong-password-123');
    await expectAlert('Invalid login credentials');
    await expect($(AuthPage.info())).toBeDisplayed();
  });

  it('[UI-ACC-003] signing in with email and password closes the form and shows the account', async () => {
    await AuthPage.signIn(user.email, user.password);
    await waitGone(AuthPage.info(), 30_000);
    await ProfilePage.waitForShown();
    await waitFor(ProfilePage.email(user.email));
    await expect($(ProfilePage.signOut())).toBeDisplayed();
  });

  it('[UI-ACC-004] a country marked in the app is saved to the cloud', async () => {
    await markCountries({ visited: ['PT'] });
    const row = await eventually(async () => {
      const { data } = await adminClient().from('user_places').select('status').eq('user_id', user.id).eq('key', 'country:PT');
      return data?.[0];
    }, 45_000);
    expect(row).toEqual({ status: 'visited' });
  });

  it('[UI-ACC-005] a flight added in the app is saved to the cloud', async () => {
    await TabBar.open('travel');
    await TravelPage.open('flights');
    await FlightsPage.waitForShown();
    await addFlight({ from: 'JFK', to: 'LHR', flightNumber: 'BA112' });
    const trip = await eventually(async () => {
      const { data } = await adminClient().from('trips').select('flight_number, from_iata, to_iata, deleted').eq('user_id', user.id);
      return data?.[0];
    }, 45_000);
    expect(trip).toEqual({ flight_number: 'BA112', from_iata: 'JFK', to_iata: 'LHR', deleted: false });
  });

  it('[UI-ACC-006] a place saved from another device (Supabase) appears in the app when it returns to the foreground', async () => {
    // PT + the flight's US and GB
    await TabBar.open('map');
    await MapPage.expectCountries(3);
    const { error } = await user.client
      .from('user_places')
      .upsert({ user_id: user.id, key: 'country:BR', status: 'visited', visit_date: null, updated_at: Date.now() }, { onConflict: 'user_id,key' });
    expect(error).toBeNull();
    await App.putInBackground(3);
    await MapPage.expectCountries(4);
  });

  it('[UI-ACC-007] signing out keeps the map on the phone and shows the signed-out profile', async () => {
    await TabBar.open('profile');
    await tap(ProfilePage.signOut());
    await waitFor(ProfilePage.notSignedIn());
    await TabBar.open('map');
    await MapPage.expectCountries(4);
  });

  it('[UI-ACC-008] "Delete account" removes the account and its cloud data', async () => {
    await openSignIn();
    await AuthPage.signIn(user.email, user.password);
    await waitFor(ProfilePage.email(user.email), 30_000);
    await (await ProfilePage.deleteAccountButton()).click();
    const confirm = await Alert.waitFor();
    expect([confirm.title, confirm.message]).toContain(t('settings.deleteAccountConfirm'));
    await Alert.press(t('common.delete'));
    const result = await Alert.waitFor(30_000);
    // Show the server's error in the report when deletion fails
    expect([result.title, result.message].join(' | ')).toContain(t('settings.deleteAccountDone'));
    await Alert.dismiss();
    expect(await userExists(user.id)).toBe(false);
    await waitFor(ProfilePage.notSignedIn());
    // Deleting the account also wipes the data on the phone
    await TabBar.open('map');
    await MapPage.expectCountries(0);
  });
});
