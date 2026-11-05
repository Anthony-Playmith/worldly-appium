import { $, $$ } from '@wdio/globals';

import { byClass, byLabel, byLabelEnding, byLabelItem, byText } from '../support/selectors.js';
import { countryName, t } from '../support/strings.js';
import { hideKeyboard, isShown, scrollIntoView, tap, waitFor } from './base.js';

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
  /** Stat value shown above its label (Answered, Accuracy, Streak, Best). */
  stat: (label: 'answered' | 'accuracy' | 'streak' | 'bestStreak') =>
    `//android.widget.TextView[@text=${JSON.stringify(t(`quiz.${label}`))}]/preceding::android.widget.TextView[1]`,

  async waitForShown() {
    await waitFor(this.answered());
  },
  /** The question bank downloads on first open; wait until the Worldwide row is there. */
  async waitForBank(timeout = 90_000) {
    await waitFor(this.worldwide(), timeout);
  },
  async statValue(label: 'answered' | 'accuracy' | 'streak' | 'bestStreak') {
    return (await waitFor(this.stat(label))).getText();
  },
  /** Starts a quiz; the list may be scrolled, so the search box / Worldwide row are scrolled into view first. */
  async start(cc: string | 'WORLD') {
    if (cc === 'WORLD') {
      await (await scrollIntoView(`.descriptionMatches(${JSON.stringify(`(?s).*, ${t('quiz.worldwide')}(,.*)?$`)})`)).click();
      return;
    }
    const search = await scrollIntoView('.className("android.widget.EditText")');
    await search.click();
    await search.setValue(countryName(cc));
    await hideKeyboard();
    await tap(this.country(cc));
  },
};

export const QuizPlayPage = {
  /** React Native flattens the layout, so the question is simply the last text before the first answer button. */
  question: () => '(//android.widget.Button)[1]/preceding::android.widget.TextView[1]',
  option: (text: string) => byLabel(text),
  options: () => '//android.widget.Button',
  /** After answering, the correct option gets a check icon, which adds a trailing ", " to its label. */
  correctOption: () => 'android=new UiSelector().className("android.widget.Button").descriptionMatches("(?s).+, .?$")',
  correct: () => byText(t('quiz.correct')),
  incorrect: () => byText(t('quiz.incorrect')),
  timeUp: () => byText(t('quiz.timeUp')),
  next: () => byLabelEnding(t('quiz.next')),
  report: () => byLabelEnding(t('quiz.report')),
  reportTitle: () => byText(t('quiz.reportTitle')),
  reportReason: (r: 'wrong' | 'unclear' | 'typo' | 'other') => byText(t(`quiz.reportReasons.${r}`)),
  reportNote: () => byClass('android.widget.EditText'),
  reportSend: () => byLabel(t('quiz.reportSend')),
  dailyDone: () => byText(t('quiz.dailyDone')),
  keepPlaying: () => byLabelEnding(t('quiz.keepPlaying')),
  comeBackTomorrow: () => byLabel(t('quiz.comeBackTomorrow')),
  score: (correct: number, total: number) => byText(t('quiz.sessionScore', { correct, total })),

  async waitForQuestion(timeout = 20_000) {
    await waitFor(this.question(), timeout);
  },
  async questionText() {
    return (await waitFor(this.question())).getText();
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
  async correctOptionText() {
    const desc = (await $(this.correctOption()).getAttribute('content-desc')) ?? '';
    return desc.replace(/, .?$/s, '');
  },
};

export const SuggestPage = {
  title: () => byText(t('quiz.suggest')),
  signInHint: () => byText(t('quiz.suggestSignIn')),
};
