import { driver } from '@wdio/globals';

import { APP_ID } from '../../config/env.js';
import { TabBar } from './TabBar.js';
import { PaywallPage } from './PaywallPage.js';
import { TIMEOUT } from './base.js';

/** App lifecycle: every spec starts from a clean install state so specs never depend on each other. */
export const App = {
  /** Wipes all app data (like a fresh install), cold-starts the app and closes the launch paywall. */
  async reset() {
    await driver.execute('mobile: clearApp', { appId: APP_ID });
    await this.launch();
  },

  /** Cold start: the paywall shows on every launch for free users; it is closed unless asked not to. */
  async launch({ dismissPaywall = true } = {}) {
    await driver.activateApp(APP_ID);
    await PaywallPage.waitForShown(TIMEOUT.launch);
    if (dismissPaywall) {
      await PaywallPage.dismiss();
      await TabBar.waitForShown();
    }
  },

  /** Force-stops and relaunches the app (data is kept). */
  async restart(options?: { dismissPaywall?: boolean }) {
    await driver.terminateApp(APP_ID);
    await this.launch(options);
  },

  async putInBackground(seconds = 2) {
    await driver.execute('mobile: backgroundApp', { seconds });
  },
};
