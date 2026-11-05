import { $, driver, expect } from '@wdio/globals';

import { App } from '../../src/pages/App.js';
import { CountryPage } from '../../src/pages/CountryPage.js';
import { ExplorePage } from '../../src/pages/ExplorePage.js';
import { MapPage } from '../../src/pages/MapPage.js';
import { PaywallPage } from '../../src/pages/PaywallPage.js';
import { continentTotal } from '../../src/pages/StatsPage.js';
import { TabBar } from '../../src/pages/TabBar.js';
import { goBack, hideKeyboard, isChecked, isShown, tap, waitFor } from '../../src/pages/base.js';
import { byLabelContains, byTextMatches } from '../../src/support/selectors.js';
import { countryName, tPattern } from '../../src/support/strings.js';

/** Opens Explore from the Map's "Add places" button. */
async function openExplore() {
  await TabBar.open('map');
  await MapPage.openExplore();
  await ExplorePage.waitForShown();
}

async function backToMap() {
  await hideKeyboard();
  await goBack();
  await MapPage.waitForShown();
}

describe('Places: map, explore and country pages', () => {
  before(async () => {
    await App.reset();
  });

  it('[UI-PLC-001] marking a country as visited in Explore updates its continent and the world counter', async () => {
    await openExplore();
    await ExplorePage.markCountry('FR', 'visited');
    expect(await ExplorePage.isMarked(ExplorePage.countryRow('FR'), 'visited')).toBe(true);
    await waitFor(ExplorePage.sectionHeader('EU', 1, continentTotal('EU')));
    await backToMap();
    await expect($(MapPage.counter(1))).toBeDisplayed();
    await expect($(MapPage.percent(1))).toBeDisplayed();
  });

  it('[UI-PLC-002] the Visited filter lists only visited places and Want is empty', async () => {
    await openExplore();
    await ExplorePage.setFilter('visited');
    await waitFor(ExplorePage.countryRow('FR'));
    expect(await isShown(ExplorePage.countryRow('DE'))).toBe(false);
    await ExplorePage.setFilter('want');
    await waitFor(ExplorePage.emptyWant());
    await ExplorePage.setFilter('all');
    await backToMap();
  });

  it('[UI-PLC-003] a wish-list country (Want) is listed under Want but not counted as visited', async () => {
    await openExplore();
    await ExplorePage.markCountry('JP', 'want');
    expect(await ExplorePage.isMarked(ExplorePage.countryRow('JP'), 'want')).toBe(true);
    expect(await ExplorePage.isMarked(ExplorePage.countryRow('JP'), 'visited')).toBe(false);
    await ExplorePage.searchFor('');
    await ExplorePage.setFilter('want');
    await waitFor(ExplorePage.countryRow('JP'));
    expect(await isShown(ExplorePage.countryRow('FR'))).toBe(false);
    await ExplorePage.setFilter('all');
    await backToMap();
    await expect($(MapPage.counter(1))).toBeDisplayed();
  });

  it('[UI-PLC-004] tapping Visited again removes the mark', async () => {
    await openExplore();
    await ExplorePage.markCountry('DE', 'visited');
    expect(await ExplorePage.isMarked(ExplorePage.countryRow('DE'), 'visited')).toBe(true);
    await ExplorePage.toggle(ExplorePage.countryRow('DE'), 'visited');
    expect(await ExplorePage.isMarked(ExplorePage.countryRow('DE'), 'visited')).toBe(false);
    await backToMap();
    await expect($(MapPage.counter(1))).toBeDisplayed();
  });

  it('[UI-PLC-005] territories are tracked separately and do not change the 195 country count', async () => {
    await openExplore();
    await ExplorePage.openTab('territories');
    await ExplorePage.markCountry('GL', 'visited');
    expect(await ExplorePage.isMarked(ExplorePage.countryRow('GL'), 'visited')).toBe(true);
    await backToMap();
    await expect($(MapPage.counter(1))).toBeDisplayed();
  });

  it('[UI-PLC-006] a search with no match shows "No places found"', async () => {
    await openExplore();
    await ExplorePage.searchFor('zzqqxx');
    await waitFor(ExplorePage.noResults());
    await backToMap();
  });

  it('[UI-PLC-007] Regions, Cities and Airports lists are locked for free users and lead to the offer', async () => {
    await openExplore();
    await ExplorePage.openTab('regions');
    await waitFor(ExplorePage.lockedTitle());
    await tap(ExplorePage.getPremium());
    await PaywallPage.waitForShown(20_000);
    await PaywallPage.dismiss();
    await ExplorePage.waitForShown();
    await backToMap();
  });

  it('[UI-PLC-008] marking a UNESCO site as visited updates the UNESCO progress', async () => {
    await openExplore();
    await ExplorePage.openTab('unesco');
    await waitFor(byTextMatches(tPattern('unesco.progress', { count: 0 })));
    await ExplorePage.searchFor('Machu Picchu');
    await ExplorePage.toggle(byLabelContains('Machu Picchu'), 'visited');
    await ExplorePage.searchFor('');
    await waitFor(byTextMatches(tPattern('unesco.progress', { count: 1 })));
    await backToMap();
    // UNESCO sites don't mark their country as visited
    await expect($(MapPage.counter(1))).toBeDisplayed();
  });

  it('[UI-PLC-009] tapping a country on the map opens its card; marking it there updates the counter', async () => {
    await TabBar.open('map');
    await MapPage.openCountry('AU', 134, -25); // central Australia
    await tap(MapPage.sheetVisited());
    await MapPage.expectCountries(2);
    await tap(MapPage.details());
    await CountryPage.waitForShown('AU');
    await waitFor(CountryPage.value('Canberra'));
    await goBack();
    await tap(MapPage.sheetClose());
    expect(await MapPage.isSheetShown()).toBe(false);
  });

  it('[UI-PLC-010] a country page shows its facts, a visit date once visited, and locks regions for free users', async () => {
    await openExplore();
    await ExplorePage.searchFor(countryName('JP'));
    await tap(ExplorePage.countryRow('JP'));
    await CountryPage.waitForShown('JP');
    await waitFor(CountryPage.fact('capital'));
    await waitFor(CountryPage.value('Tokyo'));
    expect(await CountryPage.isDateFieldShown()).toBe(false);
    await CountryPage.mark('visited');
    expect(await CountryPage.isDateFieldShown(10_000)).toBe(true);
    await $(CountryPage.section('regions')).waitForExist();
    await waitFor(CountryPage.getPremium());
    await goBack();
    await backToMap();
    await expect($(MapPage.counter(3))).toBeDisplayed();
  });

  it('[UI-PLC-011] marks are saved on the phone and survive an app restart', async () => {
    await App.restart();
    await expect($(MapPage.counter(3))).toBeDisplayed();
  });

  it('[UI-PLC-012] the UNESCO map layer is off by default and can be switched on', async () => {
    await TabBar.open('map');
    await tap(MapPage.layers());
    expect(await isChecked(MapPage.unescoSwitch())).toBe(false);
    await tap(MapPage.unescoSwitch());
    expect(await isChecked(MapPage.unescoSwitch())).toBe(true);
    await driver.back();
    await MapPage.waitForShown();
  });
});
