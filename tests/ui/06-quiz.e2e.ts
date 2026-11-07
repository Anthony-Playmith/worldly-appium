import { $, driver, expect } from '@wdio/globals';

import { App } from '../../src/pages/App.js';
import { PaywallPage } from '../../src/pages/PaywallPage.js';
import { FREE_DAILY_QUESTIONS, QUESTION_SECONDS, QuizPage, QuizPlayPage, SuggestPage } from '../../src/pages/QuizPages.js';
import { TabBar } from '../../src/pages/TabBar.js';
import { Alert, goBack, tap, typeInto, waitFor } from '../../src/pages/base.js';
import { adminClient, eventually, findQuestionByText, QA_MARKER } from '../../src/support/supabase.js';
import { t } from '../../src/support/strings.js';

/** On-screen position of the right answer for every question seen (the bank stores it first; the app must shuffle). */
const correctPositions: number[] = [];

/** Reads the question on screen and finds it in the Supabase bank (the source the app downloads). */
async function currentQuestion() {
  await QuizPlayPage.waitForQuestion();
  const text = await QuizPlayPage.questionText();
  const row = await findQuestionByText(text);
  if (!row) throw new Error(`Question shown in the app is not an active question in Supabase: "${text}"`);
  const correct = row.options[row.answer];
  correctPositions.push((await QuizPlayPage.optionTexts()).indexOf(correct));
  return { text, id: row.id, correct, wrong: row.options.find((_, i) => i !== row.answer)! };
}

describe('Geography quiz', () => {
  let reportedQuestionId = '';

  before(async () => {
    await App.reset();
    await TabBar.open('quiz');
    await QuizPage.waitForShown();
    // First open downloads the whole question bank from Supabase
    await QuizPage.waitForBank();
  });

  after(async () => {
    // Remove the report filed by UI-QZ-005 so it doesn't reach the review queue
    await adminClient().from('quiz_reports').delete().like('note', `${QA_MARKER}%`).then(undefined, () => undefined);
  });

  it(`[UI-QZ-001] the quiz list loads the bank and a free user has ${FREE_DAILY_QUESTIONS} questions today`, async () => {
    await expect($(QuizPage.worldwide())).toBeDisplayed();
    await expect($(QuizPage.freeLeft(FREE_DAILY_QUESTIONS))).toBeDisplayed();
    expect(await QuizPage.statValue('answered')).toBe('0');
  });

  it('[UI-QZ-002] choosing the right answer shows "Correct!" and the session score', async () => {
    await QuizPage.start('JP');
    const q = await currentQuestion();
    await QuizPlayPage.answer(q.correct);
    await waitFor(QuizPlayPage.correct(), 10_000);
    await waitFor(QuizPlayPage.score(1, 1));
  });

  it('[UI-QZ-003] a wrong answer shows "Not quite" and highlights the right option', async () => {
    await QuizPlayPage.next();
    const q = await currentQuestion();
    await QuizPlayPage.answer(q.wrong);
    await waitFor(QuizPlayPage.incorrect(), 10_000);
    expect(await QuizPlayPage.correctOptionText(q.wrong)).toBe(q.correct);
    await waitFor(QuizPlayPage.score(1, 2));
  });

  it(`[UI-QZ-004] a question left unanswered for ${QUESTION_SECONDS} s counts as "Time's up!"`, async () => {
    await QuizPlayPage.next();
    const q = await currentQuestion();
    reportedQuestionId = q.id;
    await driver.pause((QUESTION_SECONDS + 1) * 1000);
    await waitFor(QuizPlayPage.timeUp(), 10_000);
    expect(await QuizPlayPage.correctOptionText()).toBe(q.correct);
  });

  it('[UI-QZ-005] "Report this question" sends a report that reaches Supabase', async () => {
    await QuizPlayPage.openReport();
    await waitFor(QuizPlayPage.reportTitle());
    await tap(QuizPlayPage.reportReason('typo'));
    const note = `${QA_MARKER} UI test ${Date.now()}`;
    await typeInto(QuizPlayPage.reportNote(), note);
    await driver.hideKeyboard().catch(() => undefined);
    // F-002: the button must sit fully above the navigation bar
    expect(await QuizPlayPage.reportSendOverlap()).toBe(0);
    await QuizPlayPage.sendReport();
    const alert = await Alert.waitFor();
    expect([alert.title, alert.message]).toContain(t('quiz.reportThanks'));
    await Alert.dismiss();
    const report = await eventually(async () => {
      const { data } = await adminClient().from('quiz_reports').select('question_id, reason, note').eq('note', note);
      return data?.[0];
    });
    expect(report).toEqual({ question_id: reportedQuestionId, reason: 'typo', note });
  });

  it('[UI-QZ-006] the quiz tab totals answers, accuracy and free questions left', async () => {
    await goBack();
    await QuizPage.waitForShown();
    expect(await QuizPage.statValue('answered')).toBe('3');
    expect(await QuizPage.statValue('accuracy')).toBe('33%');
    await expect($(QuizPage.freeLeft(FREE_DAILY_QUESTIONS - 3))).toBeDisplayed();
  });

  it(`[UI-QZ-007] after ${FREE_DAILY_QUESTIONS} questions the day's free quiz ends with a Premium prompt`, async () => {
    await QuizPage.start('WORLD');
    for (let i = 0; i < 2; i++) {
      const q = await currentQuestion();
      await QuizPlayPage.answer(q.correct);
      await waitFor(QuizPlayPage.correct(), 10_000);
      await QuizPlayPage.next();
    }
    await waitFor(QuizPlayPage.dailyDone());
    await tap(QuizPlayPage.keepPlaying());
    await PaywallPage.waitForShown(20_000);
    await PaywallPage.dismiss();
    await tap(QuizPlayPage.comeBackTomorrow());
    await QuizPage.waitForShown();
    await expect($(QuizPage.freeLeft(0))).toBeDisplayed();
  });

  it('[UI-QZ-010] answer options are shuffled (the right answer is not always in the same place)', async () => {
    // 5 questions were played; with a fair shuffle all five in one place happens 0.4% of the time
    expect(correctPositions).toHaveLength(FREE_DAILY_QUESTIONS);
    expect(correctPositions.every((p) => p >= 0)).toBe(true);
    expect(new Set(correctPositions).size).toBeGreaterThan(1);
  });

  it('[UI-QZ-008] with no questions left, starting a quiz opens the Premium offer', async () => {
    await QuizPage.start('JP');
    await PaywallPage.waitForShown(20_000);
    await PaywallPage.dismiss();
  });

  it('[UI-QZ-009] suggesting a question asks signed-out users to sign in', async () => {
    await TabBar.open('quiz');
    await tap(QuizPage.suggest());
    await waitFor(SuggestPage.signInHint());
    await goBack();
  });
});
