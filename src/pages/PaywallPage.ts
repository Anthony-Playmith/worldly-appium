import { byLabel, byLabelContains, byText } from '../support/selectors.js';
import { t } from '../support/strings.js';
import { isShown, tap, TIMEOUT, waitFor, waitGone } from './base.js';

/** Full-screen Premium offer shown on every cold start until Premium is bought. */
export const PaywallPage = {
  title: () => byText(t('paywall.title')),
  close: () => byLabel(t('common.close')),
  restore: () => byLabel(t('paywall.restore')),
  /** The buy button's label includes the store price, which varies by country. */
  buy: () => byLabelContains(t('paywall.buy', { price: '' }).trim()),
  feature: (key: string) => byText(t(`paywall.features.${key}`)),

  async isShown(timeout = 0) {
    return isShown(this.title(), timeout);
  },
  async waitForShown(timeout = TIMEOUT.launch) {
    await waitFor(this.title(), timeout);
  },
  async dismiss() {
    await tap(this.close());
    await waitGone(this.title());
  },
};
