import { $ } from '@wdio/globals';

import { byClass, byLabel, byLabelEnding, byLabelStartsWith, byText, byTextMatches } from '../support/selectors.js';
import { countryName, t } from '../support/strings.js';
import { hideKeyboard, isShown, tap, typeInto, waitFor } from './base.js';

export type ExploreTab = 'countries' | 'territories' | 'unesco' | 'regions' | 'cities' | 'airports';
export type Status = 'visited' | 'want';

const lit = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Explore (Add places): lists of countries, territories, UNESCO sites, regions, cities, airports. */
export const ExplorePage = {
  tab: (tab: ExploreTab) => byLabelStartsWith(t(`kinds.${tab}`)),
  filter: (f: 'all' | Status) => byText(t(`filters.${f}`)),
  search: () => byClass('android.widget.EditText'),
  /** A country/territory row: "<flag>, <name>". */
  countryRow: (cc: string) => byLabelEnding(countryName(cc)),
  /** A UNESCO row: "<site name>, <category>[ · In danger]". */
  unescoRow: (title: string) => byLabelStartsWith(`${title}, `),
  /** Continent section header, e.g. "EUROPE · 1/45" (shown upper-case). */
  sectionHeader: (continent: string, visited: number, total: number) =>
    byTextMatches(`(?i)^${lit(t(`continents.${continent}`))} · ${visited}/${total}$`),
  lockedTitle: () => byText(t('places.lockedTitle')),
  getPremium: () => byLabelEnding(t('paywall.getPremium')),
  noResults: () => byText(t('places.noResults')),
  emptyVisited: () => byText(t('places.emptyVisited')),
  emptyWant: () => byText(t('places.emptyWant')),
  unescoProgress: (count: number, total: number) => byText(t('unesco.progress', { count, total })),
  unescoFilter: (f: 'all' | 'C' | 'N' | 'M' | 'danger') => byLabel(t(`unesco.filters.${f}`)),

  async waitForShown() {
    await waitFor(this.tab('countries'));
  },
  async openTab(tab: ExploreTab) {
    await tap(this.tab(tab));
  },
  async setFilter(f: 'all' | Status) {
    await tap(this.filter(f));
  },
  async searchFor(query: string) {
    await typeInto(this.search(), query);
    await hideKeyboard();
  },

  /** The Visited / Want toggle inside a row. */
  statusButton(rowSelector: string, status: Status) {
    return $(rowSelector).$(byLabel(t(`status.${status}`)));
  },
  async toggle(rowSelector: string, status: Status) {
    await waitFor(rowSelector);
    await this.statusButton(rowSelector, status).click();
  },
  async isMarked(rowSelector: string, status: Status) {
    await waitFor(rowSelector);
    return (await this.statusButton(rowSelector, status).getAttribute('selected')) === 'true';
  },

  /** Searches a country by its localized name and marks it. */
  async markCountry(cc: string, status: Status = 'visited') {
    await this.searchFor(countryName(cc));
    await this.toggle(this.countryRow(cc), status);
  },
  async isRowShown(rowSelector: string, timeout = 0) {
    return isShown(rowSelector, timeout);
  },
};
