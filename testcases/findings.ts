/** Defects and observations found while building and running the suite (shown on the "Findings" sheet). */
export type Finding = {
  id: string;
  date: string;
  severity: 'High' | 'Medium' | 'Low' | 'Info';
  title: string;
  details: string;
  tests: string;
  suggestion: string;
  status: 'Open' | 'Fixed' | 'To confirm';
};

export const findings: Finding[] = [
  {
    id: 'F-001', date: '2026-11-05', severity: 'High', status: 'Open',
    title: '"Delete account" fails: the delete-account Edge Function is not deployed',
    details: 'POST/OPTIONS /functions/v1/delete-account answer 404 "Requested function was not found". In the app, Profile > Delete account shows "Something went wrong · Edge Function returned a non-2xx status code" and the account stays. Google Play requires in-app account deletion.',
    tests: 'API-DEL-001…005, UI-ACC-008',
    suggestion: 'Deploy it: npx supabase functions deploy delete-account --project-ref xajoygepdmcucslneawt (config.toml already sets verify_jwt = false). Then re-run npm run test:backend.',
  },
  {
    id: 'F-002', date: '2026-11-05', severity: 'Medium', status: 'Open',
    title: 'Quiz "Report this question" sheet: the Send button sits partly under the Android navigation bar',
    details: 'The bottom sheet (React Native Modal) ignores the bottom safe-area inset; on phones with 3-button navigation the lower half of "Send report" is covered and a tap there hits the system bar.',
    tests: 'UI-QZ-005 (taps the top edge as a workaround)',
    suggestion: 'Add the bottom inset (useSafeAreaInsets().bottom) to the sheet padding, here and in the map Layers sheet.',
  },
  {
    id: 'F-003', date: '2026-11-05', severity: 'Low', status: 'To confirm',
    title: 'Premium offer not shown when reopening after leaving with Back (warm start)',
    details: 'On the Nov 5 store build, pressing Back on the Map and reopening Worldly skipped the paywall (the JS runtime was still alive). A cold start always shows it. The product rule is "paywall on every launch".',
    tests: 'UI-LAU-005 covers cold start only',
    suggestion: 'Decide whether a warm start counts as a launch; if yes, also trigger the paywall on AppState "active" after a long background.',
  },
  {
    id: 'F-004', date: '2026-11-05', severity: 'Info', status: 'To confirm',
    title: 'UNESCO list has 1,272 sites; the product decision says 1,273 (after the 2026 Busan session)',
    details: 'src/data/generated/unesco.json contains 1,272 entries.',
    tests: '—',
    suggestion: 'Check whether a site is missing or merged (transboundary sites count once).',
  },
  {
    id: 'F-005', date: '2026-11-05', severity: 'Info', status: 'Open',
    title: 'Every quiz question stores the right answer first (answer = 0 for all 14,699)',
    details: 'Fair play depends entirely on the client shuffling the options. The Android app does (verified), but any other client (web, iOS, a future widget) must too.',
    tests: 'UI-QZ-010, DB-DAT-002',
    suggestion: 'Keep the shuffle; optionally randomise positions in the bank.',
  },
  {
    id: 'F-006', date: '2026-11-05', severity: 'Info', status: 'Open',
    title: 'Some quiz categories look off (e.g. "Which director co-founded Studio Ghibli?" is Geography)',
    details: 'Seen during runs; culture/trivia questions filed under Geography or Politics.',
    tests: '—',
    suggestion: 'Review categories in quiz_questions (a "culture" category exists since Oct 25).',
  },
  {
    id: 'F-007', date: '2026-11-05', severity: 'Info', status: 'Open',
    title: 'No testID on any control',
    details: 'Tests rely on accessibility labels and texts (works in every language via the app\'s translations, but labels can change).',
    tests: 'All UI',
    suggestion: 'Add testID to key controls (tabs, Save buttons, status toggles, quiz options) for sturdier selectors.',
  },
];
