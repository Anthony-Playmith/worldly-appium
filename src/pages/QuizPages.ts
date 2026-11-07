import { $, $$, driver } from '@wdio/globals';

import { alertIds, byClass, byId, byLabel, byLabelEnding, byLabelItem, byText } from '../support/selectors.js';
import { countryName, t } from '../support/strings.js';
import { getSafeArea, hideKeyboard, isShown, scrollIntoView, tap, waitFor, scrollAndTap } from './base.js';

export const FREE_DAILY_QUESTIONS = 5;
export const QUESTION_SECONDS = 15;

export const QuizPage = {
  answered: () => byText(t('quiz.answered')),
  freeLeft: (count: number) => byText(t('quiz.freeLeft', { count, total: FREE_DAILY_QUESTIONS })),
  suggest: () => byText(t('quiz.suggest')),
  search: () => byClass('android.widget.EditText'),
  worldwide: () => byLabelItem(t('quiz.worldwide')),
  country: (cc: string) => byLabelItem(countryName(cc)),
  comingSoon: () => byText(t('quiz.comingSoon')),
  /** The tab keeps its scroll position, so scroll back to the stats card at the top. */
  async waitForShown() {
    await scrollIntoView(`.text(${JSON.stringify(t('quiz.answered'))})`);
  },
  /** The question bank downloads on first open; wait until the Worldwide row is there. */
  async waitForBank(timeout = 90_000) {
    await waitFor(this.worldwide(), timeout);
  },
  /**
   * Stat value shown above its label (Answered, Accuracy, Streak, Best). The page source lists the
   * four values first and then the four labels, so the value is matched by position.
   */
  async statValue(label: 'answered' | 'accuracy' | 'streak' | 'bestStreak') {
    await this.waitForShown();
    const keys = ['answered', 'accuracy', 'streak', 'bestStreak'] as const;
    const labels = keys.map((k) => t(`quiz.${k}`));
    const texts = screenTexts(await driver.getPageSource()).filter((n) => n.cls === 'TextView').map((n) => n.text);
    const first = texts.indexOf(labels[0]);
    if (first < 0) throw new Error('Quiz stats not on screen');
    const k = keys.indexOf(label);
    const grouped = texts[first + 1] === labels[1];
    return grouped ? texts[first - keys.length + k] : texts[texts.indexOf(labels[k]) - 1];
  },
  /** Starts a quiz; the list may be scrolled, so the search box / Worldwide row are scrolled into view first. */
  async start(cc: string | 'WORLD') {
    if (cc === 'WORLD') {
      await scrollAndTap(`.descriptionMatches(${JSON.stringify(`(?s).*, ${t('quiz.worldwide')}(,.*)?$`)})`);
      return;
    }
    const search = await scrollIntoView('.className("android.widget.EditText")');
    await search.click();
    await search.setValue(countryName(cc));
    await hideKeyboard();
    await tap(this.country(cc));
  },
};

/**
 * Texts and buttons in screen order, read from the page source. (UiAutomator2's XPath engine
 * returns reverse axes like preceding::x[1] in document order, so "the text just before X" is
 * worked out here instead.)
 */
function screenTexts(xml: string) {
  const out: { cls: string; text: string; desc: string }[] = [];
  const decode = (s: string) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  for (const m of xml.matchAll(/<android\.widget\.(TextView|Button) ([^>]*)>/g)) {
    const attr = (k: string) => decode(m[2].match(new RegExp(` ${k}="([^"]*)"`))?.[1] ?? '');
    out.push({ cls: m[1], text: attr('text'), desc: attr('content-desc') });
  }
  return out;
}

export const QuizPlayPage = {
  /** The first answer button (used to know a question is on screen). */
  firstOption: () => '(//android.widget.Button)[1]',
  option: (text: string) => byLabel(text),
  options: () => '//android.widget.Button',
  correct: () => byText(t('quiz.correct')),
  incorrect: () => byText(t('quiz.incorrect')),
  timeUp: () => byText(t('quiz.timeUp')),
  reportTitle: () => byText(t('quiz.reportTitle')),
  reportReason: (r: 'wrong' | 'unclear' | 'typo' | 'other') => byText(t(`quiz.reportReasons.${r}`)),
  reportNote: () => byClass('android.widget.EditText'),
  reportSend: () => byLabel(t('quiz.reportSend')),
  dailyDone: () => byText(t('quiz.dailyDone')),
  keepPlaying: () => byLabelEnding(t('quiz.keepPlaying')),
  comeBackTomorrow: () => byLabel(t('quiz.comeBackTomorrow')),
  score: (correct: number, total: number) => byText(t('quiz.sessionScore', { correct, total })),

  async waitForQuestion(timeout = 20_000) {
    await waitFor(this.firstOption(), timeout);
  },
  /** The question is the last non-empty text before the first answer button. */
  async questionText() {
    const nodes = screenTexts(await driver.getPageSource());
    const first = nodes.findIndex((n) => n.cls === 'Button');
    const question = nodes.slice(0, first).reverse().find((n) => n.cls === 'TextView' && n.text.trim());
    if (first < 0 || !question) throw new Error('No quiz question on screen');
    return question.text;
  },
  async optionTexts(): Promise<string[]> {
    const buttons = await $$(this.options());
    const texts: string[] = [];
    for (const b of buttons) texts.push((await b.getAttribute('content-desc')) ?? '');
    return texts.filter((s) => s && s !== t('quiz.next'));
  },
  async answer(text: string) {
    await tap(this.option(text));
  },
  async feedbackShown(timeout = 10_000) {
    return (await isShown(this.correct(), timeout)) || (await isShown(this.incorrect())) || (await isShown(this.timeUp()));
  },
  /**
   * After answering, the right option gets a ✓ icon and a wrongly picked one a ✗ icon; either adds
   * a trailing ", <glyph>" to the button label. The right one is the marked option that wasn't picked
   * (or the picked one, when the answer was right).
   */
  async correctOptionText(picked?: string) {
    const marked = screenTexts(await driver.getPageSource())
      .filter((n) => n.cls === 'Button' && /, .?$/s.test(n.desc))
      .map((n) => n.desc.replace(/, .?$/s, ''))
      .filter((d) => d !== t('quiz.next') && d !== t('quiz.report'));
    const others = marked.filter((d) => d !== picked);
    return others.length ? others[0] : (marked[0] ?? '');
  },
  async next() {
    await scrollAndTap(`.descriptionContains(${JSON.stringify(t('quiz.next'))})`);
  },
  async openReport() {
    await scrollAndTap(`.descriptionContains(${JSON.stringify(t('quiz.report'))})`);
  },
  /** How far "Send report" reaches below the navigation bar's top edge, in px (0 when fully visible; F-002). */
  async reportSendOverlap() {
    const el = await waitFor(this.reportSend());
    const r = await driver.getElementRect(await el.elementId);
    return Math.max(0, r.y + r.height - (await getSafeArea()).bottom);
  },
  /** Taps "Send report" in its centre, as a person would. */
  async sendReport() {
    // The first tap can be spent blurring the note field, so tap until the confirmation appears
    for (let attempt = 0; attempt < 3 && !(await isShown(byId(alertIds.positive))); attempt++) {
      await (await waitFor(this.reportSend())).click();
      await isShown(byId(alertIds.positive), 6_000);
    }
  },
};

export const SuggestPage = {
  title: () => byText(t('quiz.suggest')),
  signInHint: () => byText(t('quiz.suggestSignIn')),
};
