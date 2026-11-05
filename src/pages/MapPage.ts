import { $$, driver } from '@wdio/globals';

import { byClass, byLabel, byLabelContains, byLabelEnding, byText } from '../support/selectors.js';
import { countryName, t } from '../support/strings.js';
import { isShown, tap, TIMEOUT, waitFor } from './base.js';

/** Size of the app's bundled world map (src/data/generated/map-countries.json). */
const MAP_W = 2000;
const MAP_H = 1336;

/** Same projection as the app's mapPaths.projectPoint (Mercator, scaled to MAP_W, 84°N at the top). */
function project(lon: number, lat: number): [number, number] {
  const k = MAP_W / (2 * Math.PI);
  const merc = (deg: number) => Math.log(Math.tan(Math.PI / 4 + (deg * Math.PI) / 360));
  return [k * ((lon * Math.PI) / 180) + MAP_W / 2, k * (merc(84) - merc(lat))];
}

export const percentOf = (count: number, total: number) => (total === 0 ? 0 : Math.round((count / total) * 1000) / 10);

export const MapPage = {
  counter: (count: number, total = 195) => byText(t('map.countriesCount', { count, total })),
  percent: (count: number, total = 195) => byText(t('map.worldPercent', { percent: percentOf(count, total) })),
  addPlaces: () => byLabel(t('map.addPlaces')),
  layers: () => byLabel(t('map.layers')),
  flatToggle: () => byLabel(t('map.flat')),
  globeToggle: () => byLabelContains(t('map.globe')),
  unescoSwitch: () => byClass('android.widget.Switch'),
  sheetClose: () => byLabel(t('common.close')),
  sheetVisited: () => byLabel(t('status.visited')),
  sheetWant: () => byLabel(t('status.want')),
  details: () => byLabelEnding(t('map.details')),

  async waitForShown() {
    await waitFor(this.addPlaces(), TIMEOUT.long);
  },
  async expectCountries(count: number, total = 195) {
    await waitFor(this.counter(count, total));
  },
  async openExplore() {
    await tap(this.addPlaces());
  },

  /** Taps a point on the world map given in degrees, using the map view's real on-screen bounds. */
  async tapLocation(lon: number, lat: number) {
    const canvas = await this.canvasBounds();
    const fit = Math.min(canvas.width / MAP_W, canvas.height / MAP_H);
    const [mx, my] = project(lon, lat);
    const x = Math.round(canvas.x + (canvas.width - MAP_W * fit) / 2 + mx * fit);
    const y = Math.round(canvas.y + (canvas.height - MAP_H * fit) / 2 + my * fit);
    await driver.tap({ x, y });
  },

  /** The Skia map is the largest plain android.view.View on the screen. */
  async canvasBounds() {
    let best = { x: 0, y: 0, width: 0, height: 0 };
    for (const v of await $$(byClass('android.view.View'))) {
      const r = await driver.getElementRect(await v.elementId);
      if (r.width * r.height > best.width * best.height) best = r;
    }
    if (!best.width) throw new Error('World map view not found');
    return best;
  },

  /** Taps a country on the map until its card opens (a tap can be lost while the map is still drawing). */
  async openCountry(cc: string, lon: number, lat: number) {
    for (let attempt = 0; attempt < 3; attempt++) {
      await this.tapLocation(lon, lat);
      if (await isShown(byText(countryName(cc)), 15_000)) break;
    }
    await this.expectCountrySheet(cc);
  },
  /** Country card shown after tapping a country on the map. */
  async expectCountrySheet(cc: string) {
    await waitFor(byText(countryName(cc)));
    await waitFor(this.details());
  },
  async isSheetShown() {
    return isShown(this.details());
  },
};
