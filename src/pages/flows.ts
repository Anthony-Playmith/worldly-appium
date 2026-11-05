/** Multi-screen flows shared by several specs. */
import { ExplorePage, type Status } from './ExplorePage.js';
import { MapPage } from './MapPage.js';
import { TabBar } from './TabBar.js';
import { goBack, hideKeyboard } from './base.js';

/** Marks countries through Map > Add places, then returns to the Map. */
export async function markCountries(marks: Partial<Record<Status, string[]>>) {
  await TabBar.open('map');
  await MapPage.openExplore();
  await ExplorePage.waitForShown();
  for (const status of ['visited', 'want'] as Status[]) {
    for (const cc of marks[status] ?? []) {
      await ExplorePage.markCountry(cc, status);
      if (!(await ExplorePage.isMarked(ExplorePage.countryRow(cc), status))) throw new Error(`Could not mark ${cc} as ${status}`);
    }
  }
  await hideKeyboard();
  await goBack();
  await MapPage.waitForShown();
}
