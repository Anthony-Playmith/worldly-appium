import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { APP_ACTIVITY, APP_ID, env } from './config/env.js';
import { connectedDevices, deviceLocale, isEmulator } from './src/support/device.js';
import { resolveLanguage, setLanguage } from './src/support/strings.js';

const reports = path.join(env.root, 'reports');
const useExternalAppium = Boolean(process.env.APPIUM_URL);
const appiumUrl = useExternalAppium ? new URL(process.env.APPIUM_URL!) : null;
process.env.APPIUM_HOME ??= path.join(env.root, '.appium');

export const config: WebdriverIO.Config = {
  runner: 'local',
  tsConfigPath: './tsconfig.json',
  hostname: appiumUrl?.hostname ?? '127.0.0.1',
  port: Number(appiumUrl?.port || 4723),
  path: '/',

  specs: ['./tests/ui/**/*.e2e.ts'],
  suites: {
    smoke: ['./tests/ui/01-launch.e2e.ts', './tests/ui/02-places.e2e.ts', './tests/ui/04-flights.e2e.ts'],
    places: ['./tests/ui/02-places.e2e.ts', './tests/ui/03-stats.e2e.ts'],
    travel: ['./tests/ui/04-flights.e2e.ts', './tests/ui/05-costs.e2e.ts'],
    quiz: ['./tests/ui/06-quiz.e2e.ts'],
    account: ['./tests/ui/07-profile.e2e.ts', './tests/ui/08-account-sync.e2e.ts'],
  },
  maxInstances: 1,

  capabilities: [
    {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      ...(env.deviceUdid ? { 'appium:udid': env.deviceUdid } : {}),
      // Installs APP_PATH on every run (builds share a version code, so "newer" can't be detected);
      // without APP_PATH the already installed Worldly is tested
      ...(env.appPath && existsSync(env.appPath) ? { 'appium:app': env.appPath, 'appium:enforceAppInstall': true } : {}),
      'appium:appPackage': APP_ID,
      'appium:appActivity': APP_ACTIVITY,
      'appium:autoLaunch': false,
      'appium:noReset': true,
      'appium:newCommandTimeout': 600,
      'appium:adbExecTimeout': 120_000,
      'appium:androidInstallTimeout': 600_000,
      'appium:uiautomator2ServerInstallTimeout': 180_000,
      'appium:uiautomator2ServerLaunchTimeout': 180_000,
      'appium:disableWindowAnimation': true,
      'appium:autoGrantPermissions': true,
      // Swaps in Appium's invisible keyboard for the session, so the on-screen keyboard never covers
      // buttons or swallows a Back press (the phone's keyboard is restored afterwards)
      'appium:hideKeyboard': true,
      // React Native re-renders constantly (e.g. the quiz timer); don't wait for the UI to be idle
      'appium:settings[waitForIdleTimeout]': 0,
      'appium:settings[waitForSelectorTimeout]': 0,
    } as WebdriverIO.Capabilities,
  ],

  logLevel: 'warn',
  bail: 0,
  waitforTimeout: 20_000,
  connectionRetryTimeout: 600_000,
  connectionRetryCount: 1,
  specFileRetries: env.isCI ? 1 : 0,
  specFileRetriesDeferred: true,

  services: useExternalAppium
    ? []
    : [['appium', { command: path.join(env.root, 'node_modules', '.bin', process.platform === 'win32' ? 'appium.cmd' : 'appium'), args: { port: 4723, logLevel: 'warn' }, appiumStartTimeout: 120_000 }]],

  framework: 'mocha',
  mochaOpts: { ui: 'bdd', timeout: 15 * 60_000 },

  reporters: [
    'spec',
    ['junit', { outputDir: path.join(reports, 'junit'), outputFileFormat: (o) => `ui-results-${o.cid}.xml` }],
  ],

  onPrepare() {
    mkdirSync(path.join(reports, 'screenshots'), { recursive: true });
    const devices = connectedDevices();
    if (!devices.length) throw new Error('No Android device found. Start an emulator or plug in a phone with USB debugging on (adb devices).');
    if (!env.deviceUdid && devices.length > 1) throw new Error(`Several devices connected (${devices.join(', ')}). Set DEVICE_UDID in .env.`);
    if (!isEmulator() && !env.allowAppDataReset) {
      throw new Error(
        'This is a real phone. Every UI spec erases Worldly\'s data on the device (places, trips, costs, quiz progress). ' +
          'Back up anything you need, then set ALLOW_APP_DATA_RESET=true in .env to continue.',
      );
    }
  },

  before() {
    const lang = env.appLanguage || resolveLanguage(deviceLocale());
    setLanguage(lang);
    console.log(`[worldly] Selectors use the app's "${lang}" texts`);
  },

  async afterTest(test, _context, { passed }) {
    if (passed) return;
    const name = `${test.parent} ${test.title}`.replace(/[^\w-]+/g, '_').slice(0, 150);
    await browser.saveScreenshot(path.join(reports, 'screenshots', `${name}.png`)).catch(() => undefined);
    const source = await browser.getPageSource().catch(() => '');
    if (source) writeFileSync(path.join(reports, 'screenshots', `${name}.xml`), source);
  },
};
