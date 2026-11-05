import { byLabel, byText, byTextMatches } from '../support/selectors.js';
import { getEntities, t } from '../support/strings.js';
import { percentOf } from './MapPage.js';
import { scrollIntoView, tap, waitFor } from './base.js';

/** Countries counted on a continent, as the app counts them ("195" leaves out Taiwan and Kosovo). */
export function continentTotal(continent: string, mode: '195' | '197' = '195') {
  return getEntities().filter((e) => e.kind === 'country' && e.continent === continent && (mode === '197' || e.un195)).length;
}

const q = (s: string) => JSON.stringify(s);

export const StatsPage = {
  worldPercent: (count: number, total = 195) => byText(`${percentOf(count, total)}%`),
  countriesOf: (count: number, total = 195) => byText(t('stats.countriesOf', { count, total })),
  basis: (mode: '195' | '197') => byLabel(t(`stats.basis${mode}`)),
  wishList: (count: number) => byText(t('stats.wantCount', { count })),
  /** The "World" card title is shown upper-case. */
  worldTitle: () => byTextMatches(`(?i)^${t('stats.world')}$`),

  async waitForShown() {
    await scrollIntoView(`.textMatches(${q(`(?i)^${t('stats.world')}$`)})`);
  },
  async setBasis(mode: '195' | '197') {
    await (await scrollIntoView(`.description(${q(t(`stats.basis${mode}`))})`)).click();
  },
  /** Scrolls to a continent's "count/total · percent%" line. */
  async expectContinent(continent: string, count: number, mode: '195' | '197' = '195') {
    const total = continentTotal(continent, mode);
    await scrollIntoView(`.text(${q(`${count}/${total} · ${percentOf(count, total)}%`)})`);
  },
  /** Regions / Cities / Airports tiles are locked (PRO) for free users; tapping one opens the paywall. */
  async openLockedTile(kind: 'regions' | 'cities' | 'airports') {
    await (await scrollIntoView(`.text(${q(t(`kinds.${kind}`))})`)).click();
  },
  async openShare() {
    await (await scrollIntoView(`.descriptionContains(${q(t('stats.share'))})`)).click();
  },
};
