import { byLabel, byLabelNth, byText, byTextNth, scrollToText } from '../support/selectors.js';
import { countryName, t } from '../support/strings.js';
import { isShown, tap, waitFor } from './base.js';

/** Country / territory detail page. */
export const CountryPage = {
  /** The name appears in the header and in the card; the card is the second one. */
  title: (cc: string) => byTextNth(countryName(cc), 1),
  fact: (labelKey: string) => byText(t(`country.${labelKey}`)),
  value: (text: string) => byText(text),
  /** The header card's buttons come first; rows below (territories, UNESCO sites) have their own. */
  visited: () => byLabelNth(t('status.visited'), 0),
  want: () => byLabelNth(t('status.want'), 0),
  /** Date field (only shown once the country is marked visited). */
  dateVisited: () => byLabel(t('country.dateVisited')),
  section: (kind: 'territories' | 'unesco' | 'regions' | 'cities' | 'airports') => scrollToText(t(`kinds.${kind}`)),
  /** First locked section's "Get Premium" button (regions; cities and airports have their own). */
  getPremium: () => `android=new UiSelector().descriptionMatches(${JSON.stringify(`(?s).*, ${t('paywall.getPremium')}$`)}).instance(0)`,

  async waitForShown(cc: string) {
    await waitFor(this.title(cc));
  },
  async mark(status: 'visited' | 'want') {
    await tap(status === 'visited' ? this.visited() : this.want());
  },
  async isDateFieldShown(timeout = 0) {
    return isShown(this.dateVisited(), timeout);
  },
};
