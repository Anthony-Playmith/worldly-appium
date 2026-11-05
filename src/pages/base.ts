import { $, $$, driver } from '@wdio/globals';

import { alertIds, byId, scrollTo } from '../support/selectors.js';

export const TIMEOUT = { short: 5_000, medium: 20_000, long: 60_000, launch: 150_000 };

/** Waits until an element matching `selector` is displayed and returns it. */
export async function waitFor(selector: string, timeout = TIMEOUT.medium) {
  const el = $(selector);
  await el.waitForDisplayed({ timeout, timeoutMsg: `Not displayed after ${timeout} ms: ${selector}` });
  return el;
}

export async function waitGone(selector: string, timeout = TIMEOUT.medium) {
  await $(selector).waitForDisplayed({ timeout, reverse: true, timeoutMsg: `Still displayed after ${timeout} ms: ${selector}` });
}

/** True if the element shows up within `timeout` ms (0 = check once). */
export async function isShown(selector: string, timeout = 0): Promise<boolean> {
  try {
    if (timeout === 0) return await $(selector).isDisplayed();
    await $(selector).waitForDisplayed({ timeout });
    return true;
  } catch {
    return false;
  }
}

export async function tap(selector: string, timeout = TIMEOUT.medium) {
  const el = await waitFor(selector, timeout);
  await el.click();
}

/**
 * Taps and waits for `expected` to appear, tapping again if the first tap was swallowed (React
 * Native sometimes uses the first tap after typing to dismiss the keyboard or blur an input).
 */
export async function tapUntil(selector: string, expected: string, attempts = 3, timeout = 8_000) {
  for (let i = 0; i < attempts; i++) {
    if (i === 0 || (await isShown(selector))) await tap(selector);
    if (await isShown(expected, timeout)) return;
  }
  throw new Error(`Tapping ${selector} did not show ${expected}`);
}

/** Selectors for any React Native Alert dialog, for use as an expected outcome. */
export const anyAlert = () => [byId(alertIds.title), byId(alertIds.message)];

/**
 * Scrolls to a button (inner UiSelector), taps it and waits until one of `outcomes` shows up.
 * Taps again (up to 3 times) only while the button is still there — a tap can be spent on
 * blurring a focused text field, or land while the list is still moving.
 */
export async function scrollTapUntil(innerUiSelector: string, outcomes: string[], timeout = 8_000) {
  const button = `android=new UiSelector()${innerUiSelector}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0 && !(await isShown(button))) break;
    await (await scrollIntoView(innerUiSelector)).click();
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      for (const o of outcomes) if (await isShown(o)) return;
      await driver.pause(300);
    }
  }
  for (const o of outcomes) if (await isShown(o)) return;
  throw new Error(`Tapping ${innerUiSelector} did not lead to any of: ${outcomes.join(' | ')}`);
}

/** Replaces the text of an input. */
export async function typeInto(selector: string, text: string) {
  const el = await waitFor(selector);
  await el.click();
  await el.setValue(text);
}

export async function hideKeyboard() {
  // With the session's invisible Appium keyboard (capability hideKeyboard) nothing ever covers the screen
  if ((driver.requestedCapabilities as Record<string, unknown>)['appium:hideKeyboard']) return;
  if (await driver.isKeyboardShown().catch(() => false)) await driver.hideKeyboard().catch(() => undefined);
}

/**
 * Scrolls the screen's scroll view (from the top) until the element is visible, waits for the
 * scroll to settle so a tap lands where the element really is, and returns it.
 */
export async function scrollIntoView(innerUiSelector: string) {
  await $(scrollTo(innerUiSelector)).waitForExist({ timeout: TIMEOUT.medium });
  await driver.pause(700);
  return waitFor(`android=new UiSelector()${innerUiSelector}`);
}

export async function textOf(selector: string) {
  return (await waitFor(selector)).getText();
}

export async function isSelected(selector: string) {
  return (await (await waitFor(selector)).getAttribute('selected')) === 'true';
}

export async function isChecked(selector: string) {
  return (await (await waitFor(selector)).getAttribute('checked')) === 'true';
}

export const count = async (selector: string) => (await $$(selector)).length;

/** The React Native header back button. */
export async function goBack() {
  await driver.back();
}

/** Android dialog shown by React Native's Alert.alert(). */
export const Alert = {
  async waitFor(timeout = TIMEOUT.medium) {
    await waitFor(byId(alertIds.title), timeout).catch(() => waitFor(byId(alertIds.message), 1000));
    return { title: await this.title(), message: await this.message() };
  },
  async title() {
    return (await isShown(byId(alertIds.title))) ? $(byId(alertIds.title)).getText() : '';
  },
  async message() {
    return (await isShown(byId(alertIds.message))) ? $(byId(alertIds.message)).getText() : '';
  },
  /** Taps a dialog button by its label (Android may render it in capitals). */
  async press(label: string) {
    const text = `(?i)${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`;
    await tap(`android=new UiSelector().resourceIdMatches("android:id/button[123]").textMatches(${JSON.stringify(text)})`);
    await waitGone(byId(alertIds.title), TIMEOUT.short).catch(() => undefined);
  },
  async dismiss() {
    await tap(byId(alertIds.positive));
  },
  async isOpen() {
    return (await isShown(byId(alertIds.title))) || (await isShown(byId(alertIds.message)));
  },
};
