import { $ } from '@wdio/globals';

import { byClass, byLabel, byLabelEnding, byLabelItem, byLabelNth, byLabelStartsWith, byText, byTextStartsWith, inputAfterLabel } from '../support/selectors.js';
import { t } from '../support/strings.js';
import { hideKeyboard, isShown, scrollIntoView, tap, typeInto, waitFor, scrollAndTap } from './base.js';

const q = (s: string) => JSON.stringify(s);

/**
 * Profile tab: account, avatar, travels, premium, preferences, support, legal and account deletion.
 * (Builds before Nov 2026 kept preferences on a separate Settings screen behind a gear button;
 * `openPreferences` handles both layouts.)
 */
export const ProfilePage = {
  nameInput: () => byLabel(t('settings.name')),
  notSignedIn: () => byText(t('profile.notSignedIn')),
  signIn: () => byLabelEnding(t('settings.signIn')),
  signOut: () => byLabel(t('settings.signOut')),
  email: (email: string) => byText(email),
  avatarCreate: () => byText(t('avatar.create')),
  avatarEdit: () => byLabel(t('avatar.edit')),
  achievements: () => byLabelItem(t('stats.achievements')),
  timeline: () => byLabelItem(t('stats.timeline')),
  getPremium: () => byLabelEnding(t('paywall.getPremium')),
  legacySettings: () => byLabel(t('settings.title')),

  async waitForShown() {
    // The tab keeps its scroll position, so scroll back up to the travels section
    await scrollIntoView(`.descriptionMatches(${q(`(?s).*, ${t('stats.achievements')}(,.*)?$`)})`);
  },
  /** Older builds keep preferences behind a Settings gear; newer ones show them inline. */
  async openPreferences() {
    if (await isShown(this.legacySettings())) await tap(this.legacySettings());
  },
  async setName(name: string) {
    await this.openPreferences();
    const input = await scrollIntoView(`.description(${q(t('settings.name'))})`);
    await input.click();
    await input.setValue(name);
    await hideKeyboard();
  },
  async nameValue() {
    return (await scrollIntoView(`.description(${q(t('settings.name'))})`)).getText();
  },
  async openLanguage() {
    await scrollAndTap(`.text(${q(t('settings.language'))})`);
  },
  async setTheme(key: 'system' | 'light' | 'dark') {
    const label = t(`settings.theme${key[0].toUpperCase()}${key.slice(1)}`);
    await scrollAndTap(`.description(${q(label)})`);
  },
  async themeSelected(key: 'system' | 'light' | 'dark') {
    const label = t(`settings.theme${key[0].toUpperCase()}${key.slice(1)}`);
    return (await (await scrollIntoView(`.description(${q(label)})`)).getAttribute('selected')) === 'true';
  },
  async tapMapTheme(id: 'classic' | 'ocean' | 'emerald') {
    await scrollAndTap(`.description(${q(t(`settings.mapThemes.${id}`))})`);
  },
  async setCountBasis(mode: '195' | '197') {
    await scrollAndTap(`.description(${q(t(`stats.basis${mode}`))})`);
  },
  async deleteAccountButton() {
    return scrollIntoView(`.descriptionContains(${q(t('settings.deleteAccount'))})`);
  },
  async openAchievements() {
    await tap(this.achievements());
  },
  async openTimeline() {
    await tap(this.timeline());
  },
  async openSignIn() {
    await scrollAndTap(`.descriptionContains(${q(t('settings.signIn'))})`);
  },
  async version() {
    return (await scrollIntoView(`.textStartsWith(${q(t('settings.version', { version: '' }).trim())})`)).getText();
  },
};

export const LanguagePage = {
  option: (label: string) => byText(label),
  async choose(label: string) {
    await scrollAndTap(`.text(${q(label)})`);
  },
};

export const AchievementsPage = {
  unlocked: (count: number, total: number) => byText(t('achievements.unlocked', { count, total })),
  header: () => byTextStartsWith(t('achievements.unlocked', { count: '#', total: '#' }).split('#')[0]),
  item: (key: string, params: Record<string, string | number>) => byText(t(`achievements.${key}`, params)),

  async headerText() {
    return (await waitFor(this.header())).getText();
  },
};

export const TimelinePage = {
  empty: () => byText(t('timeline.empty')),
};

/** Sign-in / create-account modal. The tab and the submit button share a label, so the submit is the 2nd. */
export const AuthPage = {
  info: () => byText(t('auth.syncInfo')),
  tab: (mode: 'signIn' | 'signUp') => byLabelNth(t(mode === 'signIn' ? 'auth.signInTab' : 'auth.signUpTab'), 0),
  submit: (mode: 'signIn' | 'signUp') => byLabelNth(t(mode === 'signIn' ? 'auth.submitSignIn' : 'auth.submitSignUp'), 1),
  email: () => inputAfterLabel(t('auth.email')),
  password: () => inputAfterLabel(t('auth.password')),
  forgot: () => byLabel(t('auth.forgot')),
  google: () => byLabelEnding(t('auth.google')),
  passwordHint: () => byTextStartsWith(t('form.minChars', { min: 8, count: '#' }).split('#')[0]),

  async waitForShown() {
    await waitFor(this.info());
  },
  async signIn(email: string, password: string) {
    await typeInto(this.email(), email);
    await typeInto(this.password(), password);
    await hideKeyboard();
    await tap(this.submit('signIn'));
  },
};

export const AvatarPage = {
  title: () => byText(t('avatar.title')),
  surprise: () => byLabelEnding(t('avatar.surprise')),
  save: () => byLabel(t('common.save')),
  saveText: () => byText(t('common.save')),
  remove: () => byLabelEnding(t('avatar.remove')),
  tab: (key: string) => byLabel(t(`avatar.tabs.${key}`)),
  option: (field: string, value: string) => byLabelStartsWith(t(`avatar.values.${field}.${value}`)),

  async waitForShown() {
    await waitFor(this.title());
  },
  async saveAvatar() {
    const el = (await isShown(this.save())) ? $(this.save()) : $(this.saveText());
    await el.click();
  },
};

export const SharePage = {
  myMap: () => byText(t('share.myMap')),
  subtitle: (countries: number, total: number) => byText(t('share.subtitle', { countries, total })),
  button: () => byLabelEnding(t('share.button')),
};

export const textField = () => byClass('android.widget.EditText');
