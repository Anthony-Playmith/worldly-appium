import { driver } from '@wdio/globals';

import { byLabelEnding } from '../support/selectors.js';
import { t } from '../support/strings.js';
import { isSelected, isShown, tap, TIMEOUT, waitFor } from './base.js';

export type Tab = 'map' | 'stats' | 'travel' | 'quiz' | 'profile';

/** Bottom tab bar. Each tab's label is "<icon glyph>, <title>". */
export const TabBar = {
  tab: (tab: Tab) => byLabelEnding(t(`tabs.${tab}`)),

  async waitForShown(timeout = TIMEOUT.long) {
    await waitFor(this.tab('map'), timeout);
  },
  /** Opens a tab; if a pushed screen hides the tab bar, goes back to it first (up to 3 screens). */
  async open(tab: Tab) {
    for (let i = 0; i < 3 && !(await isShown(this.tab(tab), 2_000)); i++) await driver.back();
    await tap(this.tab(tab));
  },
  async isActive(tab: Tab) {
    return isSelected(this.tab(tab));
  },
};
