import { $, expect } from '@wdio/globals';

import { App } from '../../src/pages/App.js';
import {
  addExpense,
  amountText,
  CostGroupEditPage,
  CostGroupPage,
  CostsListPage,
  createGroup,
  ExpensePage,
  FREE_COST_GROUP_LIMIT,
  FREE_EXPENSE_LIMIT,
} from '../../src/pages/CostsPages.js';
import { PaywallPage } from '../../src/pages/PaywallPage.js';
import { TabBar } from '../../src/pages/TabBar.js';
import { TravelPage } from '../../src/pages/TravelPages.js';
import { Alert, goBack, hideKeyboard, isShown, tap, waitFor } from '../../src/pages/base.js';
import { byTextContains } from '../../src/support/selectors.js';
import { t } from '../../src/support/strings.js';

const GROUP = { name: 'QA Japan trip', currency: 'USD', members: ['Ana', 'Ben'], budget: 1000 };

async function openCosts() {
  await TabBar.open('travel');
  await TravelPage.open('costs');
  await CostsListPage.waitForShown();
}

async function expectAlert(text: string) {
  const alert = await Alert.waitFor();
  expect([alert.title, alert.message]).toContain(text);
  await Alert.dismiss();
}

describe('Travel costs', () => {
  before(async () => {
    await App.reset();
  });

  it('[UI-CST-001] with no groups the list shows the empty state and the free counter', async () => {
    await openCosts();
    await expect($(CostsListPage.empty())).toBeDisplayed();
    await expect($(CostsListPage.freeCounter(0))).toBeDisplayed();
  });

  it('[UI-CST-002] a group needs a name and at least one person', async () => {
    await CostsListPage.openNew();
    await CostGroupEditPage.waitForShown();
    await CostGroupEditPage.save();
    await expectAlert(t('costs.nameRequired'));
    await CostGroupEditPage.setName(GROUP.name);
    await CostGroupEditPage.save();
    await expectAlert(t('costs.membersRequired'));
  });

  it('[UI-CST-003] the same person cannot be added twice', async () => {
    await CostGroupEditPage.addMembers('Ana');
    await $(CostGroupEditPage.memberInput()).setValue('ana');
    await tap(CostGroupEditPage.addMember());
    await expectAlert(t('costs.duplicateMember'));
    await hideKeyboard();
    await goBack();
    await CostsListPage.waitForShown();
  });

  it('[UI-CST-004] creating a group with currency, people and budget opens the group', async () => {
    await createGroup(GROUP);
    await expect($(CostGroupPage.noExpenses())).toBeDisplayed();
  });

  it('[UI-CST-005] an equally split expense is listed and Balances show who owes whom', async () => {
    await addExpense({ title: 'Dinner', amount: 120, paidBy: 'Ana', category: 'food' });
    await CostGroupPage.waitForShown(GROUP.name);
    await waitFor(CostGroupPage.expense('Dinner'));
    await CostGroupPage.openTab('balances');
    await waitFor(CostGroupPage.transfer('Ben', 'Ana'));
    await waitFor(byTextContains(amountText(60)));
  });

  it('[UI-CST-006] an "Amounts" split that does not add up to the total is rejected', async () => {
    await CostGroupPage.openTab('expenses');
    await CostGroupPage.openNewExpense();
    await ExpensePage.waitForShown();
    await ExpensePage.fill({ title: 'Taxi', amount: 50, paidBy: 'Ben' });
    await ExpensePage.splitBy('exact', [20, 20]);
    await ExpensePage.save();
    await expectAlert(t('costs.splitErrors.exactMismatch'));
    await hideKeyboard();
    await goBack();
    await CostGroupPage.waitForShown(GROUP.name);
  });

  it('[UI-CST-007] "Mark paid" records the payment and everyone is settled', async () => {
    await CostGroupPage.openTab('balances');
    await tap(CostGroupPage.markPaid());
    await Alert.waitFor();
    await Alert.press(t('costs.markPaid'));
    await waitFor(CostGroupPage.allSettled());
  });

  it('[UI-CST-008] the Summary tab shows the total spent', async () => {
    await CostGroupPage.openTab('summary');
    await waitFor(CostGroupPage.totalSpent());
    await waitFor(byTextContains(amountText(120)));
  });

  it('[UI-CST-009] the group card in the list shows people and expenses', async () => {
    await goBack();
    await CostsListPage.waitForShown();
    await waitFor(byTextContains(t('costs.membersCount', { count: 2 })));
    await waitFor(byTextContains(t('costs.expensesCount', { count: 1 })));
    await expect($(CostsListPage.freeCounter(1))).toBeDisplayed();
  });

  it(`[UI-CST-010] free users get ${FREE_EXPENSE_LIMIT} expenses per group; the next one explains the limit`, async () => {
    await tap(CostsListPage.group(GROUP.name));
    await CostGroupPage.waitForShown(GROUP.name);
    await waitFor(CostGroupPage.freeExpenses(1));
    for (let i = 2; i <= FREE_EXPENSE_LIMIT; i++) await addExpense({ title: `Snack ${i}`, amount: 10 });
    await waitFor(CostGroupPage.freeExpenses(FREE_EXPENSE_LIMIT));
    await CostGroupPage.openNewExpense();
    await expectAlert(t('costs.expenseLimitTitle'));
    expect(await isShown(ExpensePage.title())).toBe(false);
    await goBack();
    await CostsListPage.waitForShown();
  });

  it(`[UI-CST-011] free users get ${FREE_COST_GROUP_LIMIT} groups; the next one opens the Premium offer`, async () => {
    await createGroup({ name: 'QA Group 2', members: ['Ana'] });
    await goBack();
    await createGroup({ name: 'QA Group 3', members: ['Ana'] });
    await goBack();
    await waitFor(CostsListPage.limitReached());
    await CostsListPage.openNew();
    await PaywallPage.waitForShown(20_000);
    await PaywallPage.dismiss();
    await CostsListPage.waitForShown();
  });

  it('[UI-CST-012] deleting a group asks for confirmation and frees a slot', async () => {
    await tap(CostsListPage.group('QA Group 3'));
    await CostGroupPage.waitForShown('QA Group 3');
    await tap(CostGroupPage.edit());
    await CostGroupEditPage.waitForShown(true);
    await CostGroupEditPage.deleteGroup();
    await Alert.waitFor();
    await Alert.press(t('common.delete'));
    await CostsListPage.waitForShown();
    await waitFor(CostsListPage.freeCounter(2));
    expect(await isShown(CostsListPage.group('QA Group 3'))).toBe(false);
  });
});
