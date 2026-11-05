import { $, expect } from '@wdio/globals';

import { App } from '../../src/pages/App.js';
import { MapPage } from '../../src/pages/MapPage.js';
import { PaywallPage } from '../../src/pages/PaywallPage.js';
import { AchievementsPage, ProfilePage, SharePage } from '../../src/pages/ProfilePages.js';
import { StatsPage } from '../../src/pages/StatsPage.js';
import { TabBar } from '../../src/pages/TabBar.js';
import { goBack, waitFor } from '../../src/pages/base.js';
import { markCountries } from '../../src/pages/flows.js';
import { byTextMatches } from '../../src/support/selectors.js';
import { tPattern } from '../../src/support/strings.js';

describe('Stats, sharing and achievements', () => {
  before(async () => {
    await App.reset();
    // Two visited countries in Europe and one on the wish list
    await markCountries({ visited: ['FR', 'ES'], want: ['IT'] });
  });

  it('[UI-STA-001] the World card shows the visited share of the 195 countries and the wish list', async () => {
    await TabBar.open('stats');
    await StatsPage.waitForShown();
    await expect($(StatsPage.worldPercent(2))).toBeDisplayed();
    await expect($(StatsPage.countriesOf(2))).toBeDisplayed();
    await expect($(StatsPage.wishList(1))).toBeDisplayed();
  });

  it('[UI-STA-002] the continent breakdown counts Europe correctly', async () => {
    await TabBar.open('stats');
    await StatsPage.expectContinent('EU', 2);
    await StatsPage.expectContinent('AS', 0);
  });

  it('[UI-STA-003] switching the count to 197 (+ Taiwan, Kosovo) changes the totals everywhere', async () => {
    await TabBar.open('stats');
    await StatsPage.waitForShown();
    await StatsPage.setBasis('197');
    await waitFor(StatsPage.countriesOf(2, 197));
    await TabBar.open('map');
    await MapPage.expectCountries(2, 197);
    await TabBar.open('stats');
    await StatsPage.setBasis('195');
    await waitFor(StatsPage.countriesOf(2, 195));
  });

  it('[UI-STA-004] the locked Regions tile opens the Premium offer', async () => {
    await TabBar.open('stats');
    await StatsPage.openLockedTile('regions');
    await PaywallPage.waitForShown(20_000);
    await PaywallPage.dismiss();
  });

  it('[UI-STA-005] "Share my map" opens a preview with the visited count', async () => {
    await TabBar.open('stats');
    await StatsPage.openShare();
    await waitFor(SharePage.myMap());
    await waitFor(SharePage.subtitle(2, 195));
    await goBack();
  });

  it('[UI-STA-006] achievements unlock with the first visited country', async () => {
    await TabBar.open('profile');
    await ProfilePage.openAchievements();
    await waitFor(byTextMatches(tPattern('achievements.unlocked', { count: 1 })));
    await waitFor(AchievementsPage.item('countries', { n: 1 }));
    await goBack();
    await expect($(ProfilePage.achievements())).toBeDisplayed();
  });
});
