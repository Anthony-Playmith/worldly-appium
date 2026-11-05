import { $, driver, expect } from '@wdio/globals';

import { APP_ID } from '../../config/env.js';
import { App } from '../../src/pages/App.js';
import { MapPage } from '../../src/pages/MapPage.js';
import { PaywallPage } from '../../src/pages/PaywallPage.js';
import { ProfilePage } from '../../src/pages/ProfilePages.js';
import { QuizPage } from '../../src/pages/QuizPages.js';
import { StatsPage } from '../../src/pages/StatsPage.js';
import { TabBar } from '../../src/pages/TabBar.js';
import { TravelPage } from '../../src/pages/TravelPages.js';
import { isSelected, tap } from '../../src/pages/base.js';

describe('Launch, paywall and navigation', () => {
  before(async () => {
    await driver.execute('mobile: clearApp', { appId: APP_ID });
  });

  it('[UI-LAU-001] cold start shows the Premium offer with price, features and restore', async () => {
    await App.launch({ dismissPaywall: false });
    await expect($(PaywallPage.title())).toBeDisplayed();
    await expect($(PaywallPage.buy())).toBeDisplayed();
    await expect($(PaywallPage.restore())).toBeDisplayed();
    await expect($(PaywallPage.feature('quiz'))).toBeDisplayed();
    await expect($(PaywallPage.feature('trips'))).toBeDisplayed();
  });

  it('[UI-LAU-002] closing the offer lands on the Map with no countries visited', async () => {
    await PaywallPage.dismiss();
    await MapPage.waitForShown();
    await expect($(MapPage.counter(0))).toBeDisplayed();
    await expect($(MapPage.percent(0))).toBeDisplayed();
    expect(await TabBar.isActive('map')).toBe(true);
  });

  it('[UI-LAU-003] the tab bar opens Stats, Travel, Quiz and Profile', async () => {
    await TabBar.open('stats');
    await StatsPage.waitForShown();
    await TabBar.open('travel');
    await TravelPage.waitForShown();
    await TabBar.open('quiz');
    await QuizPage.waitForShown();
    await TabBar.open('profile');
    await ProfilePage.waitForShown();
    await TabBar.open('map');
    await MapPage.waitForShown();
  });

  it('[UI-LAU-004] the 3D globe is Premium: tapping it opens the offer and the flat map stays selected', async () => {
    await TabBar.open('map');
    await tap(MapPage.globeToggle());
    await PaywallPage.waitForShown(20_000);
    await PaywallPage.dismiss();
    expect(await isSelected(MapPage.flatToggle())).toBe(true);
  });

  it('[UI-LAU-005] the offer shows again on the next launch for free users', async () => {
    await App.restart({ dismissPaywall: false });
    await expect($(PaywallPage.title())).toBeDisplayed();
    await PaywallPage.dismiss();
    await MapPage.waitForShown();
  });
});
