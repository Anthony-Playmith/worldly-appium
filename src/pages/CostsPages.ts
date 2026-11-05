import { $, $$, driver } from '@wdio/globals';

import { byClass, byLabel, byLabelEnding, byLabelItem, byText, byTextContains, editText, inputAfterLabel } from '../support/selectors.js';
import { language, t } from '../support/strings.js';
import { anyAlert, hideKeyboard, isShown, scrollIntoView, scrollTapUntil, tap, tapUntil, typeInto, waitFor, waitGone, scrollAndTap } from './base.js';

export const FREE_COST_GROUP_LIMIT = 3;
export const FREE_EXPENSE_LIMIT = 7;

/** Amount as the app formats it, without the currency symbol (which differs by locale). */
export const amountText = (n: number) => new Intl.NumberFormat(language(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export const CostsListPage = {
  title: () => byText(t('costs.title')),
  add: () => byLabel(t('costs.newGroup')),
  empty: () => byText(t('costs.empty')),
  freeCounter: (count: number) => byText(t('costs.freeLimit', { count, limit: FREE_COST_GROUP_LIMIT })),
  limitReached: () => byText(t('costs.limitReached', { limit: FREE_COST_GROUP_LIMIT })),
  /** Group card: "<name>, <spent>, People: n · Expenses: n…". */
  group: (name: string) => `android=new UiSelector().descriptionStartsWith(${JSON.stringify(`${name}, `)})`,

  async waitForShown() {
    await waitFor(this.add());
  },
  async openNew() {
    await tap(this.add());
  },
};

export const CurrencyPicker = {
  /** The picker opens over the form (whose fields stay visible to Appium), so it is driven by its own search box. */
  async choose(fieldLabel: string, code: string) {
    await scrollAndTap(`.description(${JSON.stringify(fieldLabel)})`);
    await typeInto(editText(t('costs.searchCurrency')), code);
    // Rows are labelled "<code>" or "<code>, <name>"; the picker's Close button shows it is still open
    const row = `android=new UiSelector().descriptionMatches(${JSON.stringify(`^${code}(,.*)?$`)})`;
    const close = byLabel(t('common.close'));
    for (let i = 0; i < 3 && (await isShown(close)); i++) {
      if (await isShown(row, 5_000)) await $(row).click();
      await driver.pause(800);
    }
    await waitGone(close);
  },
};

export const CostGroupEditPage = {
  title: (existing = false) => byText(t(existing ? 'costs.editGroup' : 'costs.newGroup')),
  name: () => inputAfterLabel(t('costs.groupName')),
  currency: () => byLabel(t('costs.mainCurrency')),
  memberInput: () => editText(t('costs.memberPlaceholder')),
  addMember: () => byLabel(t('costs.addMember')),
  member: (name: string) => byLabel(t('costs.removeMember', { name })),
  budget: () => editText('0'),
  flightChip: (from: string, to: string) => byLabel(`${from} → ${to}`),
  saveButton: () => byLabel(t('common.save')),
  delete: () => byLabelEnding(t('costs.deleteGroup')),

  async waitForShown(existing = false) {
    await waitFor(this.title(existing));
  },
  async setName(name: string) {
    await typeInto(this.name(), name);
  },
  async setCurrency(code: string) {
    await CurrencyPicker.choose(t('costs.mainCurrency'), code);
  },
  async addMembers(...names: string[]) {
    for (const n of names) {
      await (await scrollIntoView(`.className("android.widget.EditText").text(${JSON.stringify(t('costs.memberPlaceholder'))})`)).setValue(n);
      await tapUntil(this.addMember(), this.member(n));
    }
  },
  async setBudget(amount: number) {
    await (await scrollIntoView('.className("android.widget.EditText").text("0")')).setValue(String(amount));
    await hideKeyboard();
  },
  /** Saves; ends on a validation alert or on the group page. */
  async save() {
    await hideKeyboard();
    await scrollTapUntil(`.description(${JSON.stringify(t('common.save'))})`, [...anyAlert(), CostGroupPage.tab('expenses')]);
  },
  /** Taps Delete cost group; ends on the confirmation alert. */
  async deleteGroup() {
    await hideKeyboard();
    await scrollTapUntil(`.descriptionContains(${JSON.stringify(t('costs.deleteGroup'))})`, anyAlert());
  },
};

export const CostGroupPage = {
  title: (name: string) => byText(name),
  tab: (key: 'expenses' | 'balances' | 'summary') => byLabel(t(`costs.tabs.${key}`)),
  newExpense: () => byLabel(t('costs.newExpense')),
  edit: () => byLabel(t('costs.editGroup')),
  share: () => byLabel(t('costs.shareSummary')),
  noExpenses: () => byText(t('costs.noExpenses')),
  expense: (title: string) => byLabelItem(title),
  freeExpenses: (count: number) => byText(t('costs.freeExpensesUsed', { count, limit: FREE_EXPENSE_LIMIT })),
  transfer: (from: string, to: string) => byText(`${from} → ${to}`),
  markPaid: () => byLabel(t('costs.markPaid')),
  allSettled: () => byText(t('costs.allSettled')),
  /** First text on screen containing this amount (it usually appears in several places). */
  amount: (n: number) => `android=new UiSelector().textContains(${JSON.stringify(amountText(n))}).instance(0)`,
  totalSpent: () => byText(t('costs.totalSpent')),

  async waitForShown(name: string) {
    await waitFor(this.title(name));
    await waitFor(this.tab('expenses'));
  },
  async openTab(key: 'expenses' | 'balances' | 'summary') {
    await tap(this.tab(key));
  },
  async openNewExpense() {
    await tap(this.newExpense());
  },
};

export type SplitMode = 'equal' | 'exact' | 'percent' | 'shares';

export const ExpensePage = {
  title: (existing = false) => byText(t(existing ? 'costs.editExpense' : 'costs.newExpense')),
  what: () => inputAfterLabel(t('costs.expenseTitle')),
  amount: () => inputAfterLabel(t('costs.amount')),
  paidBy: (name: string) => byLabel(name),
  category: (key: string) => byLabelEnding(t(`costs.categories.${key}`)),
  split: (mode: SplitMode) => byLabel(t(`costs.splitModes.${mode}`)),
  shareInputs: () => editText('0'),

  async waitForShown(existing = false) {
    await waitFor(this.title(existing));
  },
  async fill(e: { title: string; amount: number; paidBy?: string; category?: string }) {
    await typeInto(this.what(), e.title);
    await typeInto(this.amount(), String(e.amount));
    await hideKeyboard();
    if (e.paidBy) await tap(this.paidBy(e.paidBy));
    if (e.category) await tap(this.category(e.category));
  },
  /** Chooses a split mode and types each included person's value, in member order. */
  async splitBy(mode: SplitMode, values: number[] = []) {
    await scrollAndTap(`.description(${JSON.stringify(t(`costs.splitModes.${mode}`))})`);
    if (mode === 'equal') return;
    for (let i = 0; i < values.length; i++) {
      const inputs = await $$(this.shareInputs());
      // Inputs that already have a value no longer show the "0" placeholder, so the next empty one is always first
      await inputs[0].click();
      await inputs[0].setValue(String(values[i]));
    }
    await hideKeyboard();
  },
  /** Saves; ends on a validation alert or back on the group page. */
  async save() {
    await hideKeyboard();
    await scrollTapUntil(`.description(${JSON.stringify(t('common.save'))})`, [...anyAlert(), CostGroupPage.newExpense()]);
  },
};

/** Creates a group through the form; ends on the new group's page. */
export async function createGroup(g: { name: string; members: string[]; currency?: string; budget?: number }) {
  await CostsListPage.openNew();
  await CostGroupEditPage.waitForShown();
  await CostGroupEditPage.setName(g.name);
  await hideKeyboard();
  if (g.currency) await CostGroupEditPage.setCurrency(g.currency);
  await CostGroupEditPage.addMembers(...g.members);
  if (g.budget != null) await CostGroupEditPage.setBudget(g.budget);
  await CostGroupEditPage.save();
  await CostGroupPage.waitForShown(g.name);
}

/** Adds an expense through the form; ends back on the group page. */
export async function addExpense(e: { title: string; amount: number; paidBy?: string; category?: string; split?: SplitMode; values?: number[] }) {
  await CostGroupPage.openNewExpense();
  await ExpensePage.waitForShown();
  await ExpensePage.fill(e);
  if (e.split) await ExpensePage.splitBy(e.split, e.values);
  await ExpensePage.save();
}
