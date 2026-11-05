import { $, expect } from '@wdio/globals';

import { App } from '../../src/pages/App.js';
import { MapPage } from '../../src/pages/MapPage.js';
import { PaywallPage } from '../../src/pages/PaywallPage.js';
import { AvatarPage, LanguagePage, ProfilePage } from '../../src/pages/ProfilePages.js';
import { TabBar } from '../../src/pages/TabBar.js';
import { Alert, isShown, tap, waitFor } from '../../src/pages/base.js';
import { byText } from '../../src/support/selectors.js';
import { language, setLanguage, t } from '../../src/support/strings.js';

async function openProfile() {
  await TabBar.open('profile');
  await ProfilePage.waitForShown();
}

describe('Profile and preferences', () => {
  before(async () => {
    await App.reset();
  });

  it('[UI-PRF-001] signed out: the profile offers sign-in and account deletion is disabled', async () => {
    await openProfile();
    await expect($(ProfilePage.notSignedIn())).toBeDisplayed();
    await expect($(ProfilePage.signIn())).toBeDisplayed();
    const del = await ProfilePage.deleteAccountButton();
    expect(await del.getAttribute('enabled')).toBe('false');
    await waitFor(byText(t('settings.signInToDelete')));
  });

  it('[UI-PRF-002] the traveller name is saved and survives a restart', async () => {
    await openProfile();
    await ProfilePage.setName('QA Tester');
    await App.restart();
    await openProfile();
    expect(await ProfilePage.nameValue()).toBe('QA Tester');
  });

  it('[UI-PRF-003] the name is limited to 20 characters', async () => {
    await openProfile();
    await ProfilePage.setName('Abcdefghijklmnopqrstuvwxyz');
    expect(await ProfilePage.nameValue()).toBe('Abcdefghijklmnopqrst');
  });

  it('[UI-PRF-004] choosing the Dark theme selects it', async () => {
    await openProfile();
    await ProfilePage.setTheme('dark');
    expect(await ProfilePage.themeSelected('dark')).toBe(true);
    expect(await ProfilePage.themeSelected('system')).toBe(false);
    await ProfilePage.setTheme('system');
    expect(await ProfilePage.themeSelected('system')).toBe(true);
  });

  it('[UI-PRF-005] Premium map themes open the Premium offer for free users', async () => {
    await openProfile();
    await ProfilePage.tapMapTheme('ocean');
    await PaywallPage.waitForShown(20_000);
    await PaywallPage.dismiss();
  });

  it('[UI-PRF-006] the country count set in Profile (197) is used by the map', async () => {
    await openProfile();
    await ProfilePage.setCountBasis('197');
    await TabBar.open('map');
    await MapPage.expectCountries(0, 197);
    await openProfile();
    await ProfilePage.setCountBasis('195');
    await TabBar.open('map');
    await MapPage.expectCountries(0, 195);
  });

  it('[UI-PRF-007] switching the language to Español translates the app, and it can be switched back', async () => {
    const original = language();
    await openProfile();
    await ProfilePage.openLanguage();
    await LanguagePage.choose('Español');
    if (await Alert.isOpen()) await Alert.dismiss(); // only shown for right-to-left languages
    setLanguage('es');
    try {
      await waitFor(TabBar.tab('profile'));
      await openProfile();
      await ProfilePage.openLanguage();
      await LanguagePage.choose(t('settings.systemLanguage'));
    } finally {
      setLanguage(original);
    }
    await waitFor(TabBar.tab('profile'));
  });

  it('[UI-PRF-008] the travel timeline is Premium and opens the offer', async () => {
    await openProfile();
    await ProfilePage.openTimeline();
    await PaywallPage.waitForShown(20_000);
    await PaywallPage.dismiss();
  });

  it('[UI-PRF-009] a traveller can create an avatar (stored on the phone)', async () => {
    await openProfile();
    await tap(ProfilePage.avatarCreate());
    await AvatarPage.waitForShown();
    await tap(AvatarPage.surprise());
    await AvatarPage.saveAvatar();
    // Random looks may include PRO items; free users save them with free items instead
    if (await Alert.isOpen()) await Alert.press(t('avatar.useFree'));
    await ProfilePage.waitForShown();
    expect(await isShown(ProfilePage.avatarCreate(), 3_000)).toBe(false);
  });

  it('[UI-PRF-010] the app version is shown at the bottom of Profile', async () => {
    await openProfile();
    expect(await ProfilePage.version()).toMatch(/\d+\.\d+\.\d+/);
  });
});
