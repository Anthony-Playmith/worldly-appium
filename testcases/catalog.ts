/**
 * Single source of truth for the Worldly test cases. `npm run testcases:excel` turns it into
 * docs/Worldly-Test-Cases.xlsx. Automated cases use the same ID in their test title, e.g.
 * it('[UI-PLC-001] ...'), so results can be matched back; tests/catalog.check.ts enforces this.
 */
export type Priority = 'P1 - Critical' | 'P2 - High' | 'P3 - Medium';
export type Layer = 'UI' | 'API' | 'DB';
export type TestCase = {
  id: string;
  area: string;
  title: string;
  layer: Layer;
  priority: Priority;
  automation: 'Automated' | 'Manual';
  /** Spec file that automates it (automated cases only) */
  spec?: string;
  preconditions: string;
  steps: string[];
  expected: string;
  data?: string;
};

const P1: Priority = 'P1 - Critical';
const P2: Priority = 'P2 - High';
const P3: Priority = 'P3 - Medium';
const FRESH = 'Fresh install (or app data cleared); free user; paywall closed.';

const ui = (spec: string, area: string, cases: Omit<TestCase, 'layer' | 'automation' | 'spec' | 'area'>[]): TestCase[] =>
  cases.map((c) => ({ ...c, area, layer: 'UI', automation: 'Automated', spec: `tests/ui/${spec}` }));
const backend = (layer: 'API' | 'DB', spec: string, area: string, cases: Omit<TestCase, 'layer' | 'automation' | 'spec' | 'area'>[]): TestCase[] =>
  cases.map((c) => ({ ...c, area, layer, automation: 'Automated', spec: `tests/${layer.toLowerCase()}/${spec}` }));
const manual = (area: string, layer: Layer, cases: Omit<TestCase, 'layer' | 'automation' | 'area'>[]): TestCase[] =>
  cases.map((c) => ({ ...c, area, layer, automation: 'Manual' }));

export const catalog: TestCase[] = [
  // ───────────────────────────── UI: launch & navigation
  ...ui('01-launch.e2e.ts', 'Launch & paywall', [
    { id: 'UI-LAU-001', title: 'Cold start shows the Premium offer with price, features and restore', priority: P1, preconditions: 'App data cleared; app not running.',
      steps: ['Open Worldly.'], expected: '"Worldly Premium" screen with the feature list, a "Get Premium for <price>" button and "Restore purchases".' },
    { id: 'UI-LAU-002', title: 'Closing the offer lands on the Map with no countries visited', priority: P1, preconditions: 'Premium offer shown on launch.',
      steps: ['Tap the X (Close) at the top right.'], expected: 'Map tab is active and shows "0/195 countries" and "0% of the world".' },
    { id: 'UI-LAU-003', title: 'The tab bar opens Stats, Travel, Quiz and Profile', priority: P1, preconditions: FRESH,
      steps: ['Tap Stats.', 'Tap Travel.', 'Tap Quiz.', 'Tap Profile.', 'Tap Map.'], expected: 'Each tab opens its screen (World card, Travel tiles, quiz stats, profile, map).' },
    { id: 'UI-LAU-004', title: '3D globe is Premium: tapping it opens the offer; flat map stays selected', priority: P2, preconditions: FRESH,
      steps: ['On Map tap "Globe 🔒".', 'Close the offer.'], expected: 'The Premium offer opens; after closing it "Map" is still the selected view.' },
    { id: 'UI-LAU-005', title: 'The offer shows again on the next launch for free users', priority: P2, preconditions: FRESH,
      steps: ['Force-stop the app.', 'Open it again.'], expected: 'The Premium offer is shown again on launch.' },
  ]),

  // ───────────────────────────── UI: places
  ...ui('02-places.e2e.ts', 'Places (map & explore)', [
    { id: 'UI-PLC-001', title: 'Marking a country visited in Explore updates its continent and the world counter', priority: P1, preconditions: FRESH,
      steps: ['Map > + (Add places).', 'Search "France".', 'Tap the ✓ (Visited) button on France.', 'Go back to the Map.'],
      expected: 'France\'s Visited button is selected, header "EUROPE · 1/45", Map shows "1/195 countries" and "0.5% of the world".', data: 'France' },
    { id: 'UI-PLC-002', title: 'Visited filter lists only visited places; Want is empty', priority: P2, preconditions: 'France visited.',
      steps: ['Open Explore.', 'Tap the "Visited" filter.', 'Tap the "Want" filter.'], expected: 'Visited shows France only (no Germany). Want shows "Nothing on your wish list yet".' },
    { id: 'UI-PLC-003', title: 'A wish-list country (Want) is listed under Want but not counted as visited', priority: P2, preconditions: 'France visited.',
      steps: ['Explore > search "Japan" > tap ★ (Want).', 'Clear search, tap the "Want" filter.', 'Go back to Map.'], expected: 'Japan is under Want (not Visited); Map still shows 1/195.', data: 'Japan' },
    { id: 'UI-PLC-004', title: 'Tapping Visited again removes the mark', priority: P2, preconditions: '1 country visited.',
      steps: ['Explore > search "Germany" > tap ✓.', 'Tap ✓ again.', 'Go back to Map.'], expected: 'Germany is unmarked; Map still shows 1/195.' },
    { id: 'UI-PLC-005', title: 'Territories are tracked separately and do not change the 195 count', priority: P2, preconditions: '1 country visited.',
      steps: ['Explore > Territories tab.', 'Search "Greenland" > tap ✓.', 'Go back to Map.'], expected: 'Greenland marked visited; Map still shows 1/195.' },
    { id: 'UI-PLC-006', title: 'A search with no match shows "No places found"', priority: P3, preconditions: FRESH,
      steps: ['Explore > search "zzqqxx".'], expected: '"No places found" is shown.' },
    { id: 'UI-PLC-007', title: 'Regions, Cities and Airports lists are locked for free users and lead to the offer', priority: P1, preconditions: FRESH,
      steps: ['Explore > tap "Regions 🔒".', 'Tap "Get Premium".', 'Close the offer.'], expected: '"Unlock with Premium" card; Get Premium opens the Premium offer.' },
    { id: 'UI-PLC-008', title: 'Marking a UNESCO site visited updates the UNESCO progress (not the country)', priority: P2, preconditions: '1 country visited.',
      steps: ['Explore > UNESCO tab.', 'Search "Machu Picchu" > tap ✓.', 'Clear search.', 'Go back to Map.'], expected: 'Header reads "1 out of N UNESCO World Heritage properties visited"; Map still 1/195.' },
    { id: 'UI-PLC-009', title: 'Tapping a country on the map opens its card; marking it there updates the counter', priority: P1, preconditions: '1 country visited.',
      steps: ['On the map tap the middle of Australia.', 'Tap Visited on the card.', 'Tap Details.', 'Go back and close the card.'],
      expected: 'Card shows "Australia · Oceania"; counter becomes 2/195; Details shows capital Canberra; card closes.' },
    { id: 'UI-PLC-010', title: 'Country page shows facts, a visit date once visited, and locks regions', priority: P2, preconditions: '2 countries visited.',
      steps: ['Explore > search Japan > tap the row.', 'Check facts.', 'Tap Visited.', 'Scroll to Regions.'],
      expected: 'Capital Tokyo, population etc.; "Date visited" field appears after marking; Regions section shows PRO + Get Premium; Map 3/195.' },
    { id: 'UI-PLC-011', title: 'Marks are saved on the phone and survive an app restart', priority: P1, preconditions: '3 countries visited.',
      steps: ['Force-stop and reopen the app.', 'Close the offer.'], expected: 'Map still shows 3/195.' },
    { id: 'UI-PLC-012', title: 'The UNESCO map layer is off by default and can be switched on', priority: P3, preconditions: FRESH,
      steps: ['Map > Layers button.', 'Toggle "UNESCO World Heritage sites".'], expected: 'Switch starts off and turns on.' },
  ]),

  // ───────────────────────────── UI: stats
  ...ui('03-stats.e2e.ts', 'Stats & achievements', [
    { id: 'UI-STA-001', title: 'World card shows the visited share of 195 and the wish list', priority: P1, preconditions: 'France and Spain visited, Italy on Want.',
      steps: ['Open Stats.'], expected: '"1%", "2 of 195 countries", "1 on your wish list".' },
    { id: 'UI-STA-002', title: 'Continent breakdown counts Europe correctly', priority: P2, preconditions: 'As UI-STA-001.',
      steps: ['Stats > scroll to Continents.'], expected: 'Europe "2/45 · 4.4%", Asia "0/… · 0%".' },
    { id: 'UI-STA-003', title: 'Switching the count to 197 (+ Taiwan, Kosovo) changes totals everywhere', priority: P2, preconditions: 'As UI-STA-001.',
      steps: ['Stats > tap "197 (+ Taiwan, Kosovo)".', 'Open Map.', 'Back to Stats, tap "195 (UN)".'], expected: '"2 of 197 countries" and Map "2/197"; back to 195 afterwards.' },
    { id: 'UI-STA-004', title: 'The locked Regions tile opens the Premium offer', priority: P2, preconditions: 'Free user.',
      steps: ['Stats > tap the Regions (PRO) tile.'], expected: 'Premium offer opens.' },
    { id: 'UI-STA-005', title: '"Share my map" opens a preview with the visited count', priority: P2, preconditions: '2 countries visited.',
      steps: ['Stats > Share my map.'], expected: 'Preview "My travel map" with "2 of 195 countries visited".' },
    { id: 'UI-STA-006', title: 'Achievements unlock with the first visited country', priority: P3, preconditions: '2 countries visited.',
      steps: ['Profile > Achievements.'], expected: '"1 of N unlocked" and "Visit 1 countries" is unlocked.' },
  ]),

  // ───────────────────────────── UI: flights
  ...ui('04-flights.e2e.ts', 'Travel hub & flights', [
    { id: 'UI-FLT-001', title: 'Travel hub shows Flights, Travel costs, Route videos and coming-soon tickets', priority: P2, preconditions: FRESH,
      steps: ['Open the Travel tab.'], expected: 'Tiles with "Flights: 0", "Groups: 0", "Projects: 0" and "Onward tickets · Coming soon".' },
    { id: 'UI-FLT-002', title: 'With no flights the list shows the empty state', priority: P3, preconditions: FRESH,
      steps: ['Travel > Flights.'], expected: '"No trips yet" with a hint.' },
    { id: 'UI-FLT-003', title: 'Saving a flight without airports is rejected', priority: P1, preconditions: 'On Flights.',
      steps: ['Tap +.', 'Tap Save.'], expected: 'Alert "Please select both airports."' },
    { id: 'UI-FLT-004', title: 'Same departure and arrival airport is rejected', priority: P2, preconditions: 'New trip form open.',
      steps: ['From = MAD.', 'To = MAD.', 'Save.'], expected: 'Alert "Departure and arrival airports must be different."' },
    { id: 'UI-FLT-005', title: 'Adding a flight normalises the number, suggests the airline, shows distance/time', priority: P1, preconditions: 'On Flights.',
      steps: ['Tap +.', 'Flight number "ba 112".', 'From JFK, To LHR, class Business.', 'Save.'],
      expected: 'Flight number becomes "BA112", airline "British Airways"; card shows ~5,540 km · 7h 25m; "1/5 free trips used".', data: 'BA112 JFK→LHR' },
    { id: 'UI-FLT-006', title: "A new flight marks both airports' countries as visited", priority: P1, preconditions: 'Flight JFK→LHR added.',
      steps: ['Open Map.'], expected: '"2/195 countries" (United States, United Kingdom).' },
    { id: 'UI-FLT-007', title: 'Editing a flight saves the seat in capitals', priority: P2, preconditions: 'Flight exists.',
      steps: ['Tap the flight card.', 'Seat "12a".', 'Save.'], expected: 'Card shows "Seat 12A".' },
    { id: 'UI-FLT-008', title: 'Deleting a flight asks for confirmation and removes it', priority: P2, preconditions: 'Flight exists.',
      steps: ['Open the flight.', 'Tap Delete.', 'Confirm Delete.'], expected: 'Alert "Delete this trip?"; afterwards "No trips yet".' },
    { id: 'UI-FLT-009', title: 'Free users can log 5 flights; the next one opens the Premium offer', priority: P1, preconditions: 'No flights.',
      steps: ['Add 5 flights.', 'Tap + (now a lock).'], expected: '"The free version allows up to 5 trips…" text; + opens the Premium offer.' },
  ]),

  // ───────────────────────────── UI: costs
  ...ui('05-costs.e2e.ts', 'Travel costs', [
    { id: 'UI-CST-001', title: 'With no groups the list shows the empty state and the free counter', priority: P3, preconditions: FRESH,
      steps: ['Travel > Travel costs.'], expected: '"No travel costs yet" and "0/3 free cost groups used".' },
    { id: 'UI-CST-002', title: 'A group needs a name and at least one person', priority: P2, preconditions: 'On Travel costs.',
      steps: ['Tap +.', 'Save (empty).', 'Type a name, Save.'], expected: 'Alerts "Give the group a name." then "Add at least one person."' },
    { id: 'UI-CST-003', title: 'The same person cannot be added twice', priority: P3, preconditions: 'New group form.',
      steps: ['Add "Ana".', 'Add "ana".'], expected: 'Alert "That name is already in the group."' },
    { id: 'UI-CST-004', title: 'Creating a group with currency, people and budget opens the group', priority: P1, preconditions: 'On Travel costs.',
      steps: ['+ > name "QA Japan trip", currency USD, people Ana and Ben, budget 1000.', 'Save.'], expected: 'Group page with Expenses/Balances/Summary tabs and "No expenses yet".' },
    { id: 'UI-CST-005', title: 'An equally split expense is listed and Balances show who owes whom', priority: P1, preconditions: 'Group with Ana and Ben.',
      steps: ['+ > "Dinner", 120, paid by Ana, Food, split Equally.', 'Save.', 'Balances tab.'], expected: 'Dinner listed; Balances "Ben → Ana $60.00".', data: '120 USD' },
    { id: 'UI-CST-006', title: 'An "Amounts" split that does not add up is rejected', priority: P2, preconditions: 'Group with Ana and Ben.',
      steps: ['+ > "Taxi", 50, paid by Ben.', 'Split "Amounts": 20 and 20.', 'Save.'], expected: 'Alert "The amounts must add up to the total."' },
    { id: 'UI-CST-007', title: '"Mark paid" records the payment and everyone is settled', priority: P2, preconditions: 'Ben owes Ana.',
      steps: ['Balances > Mark paid.', 'Confirm Mark paid.'], expected: '"Everyone is settled up."' },
    { id: 'UI-CST-008', title: 'The Summary tab shows the total spent', priority: P3, preconditions: 'Group with expenses.',
      steps: ['Summary tab.'], expected: '"Total spent" $120.00.' },
    { id: 'UI-CST-009', title: 'The group card shows people and expenses', priority: P3, preconditions: 'Group with 1 expense.',
      steps: ['Back to Travel costs.'], expected: 'Card shows "People: 2 · Expenses: 1"; "1/3 free cost groups used".' },
    { id: 'UI-CST-010', title: 'Free users get 7 expenses per group; the next one explains the limit', priority: P1, preconditions: 'Group with 1 expense.',
      steps: ['Add expenses until there are 7.', 'Tap + again.'], expected: 'Counter "7 / 7 free expenses"; alert "Expense limit reached" and the form does not open.' },
    { id: 'UI-CST-011', title: 'Free users get 3 groups; the next one opens the Premium offer', priority: P1, preconditions: '1 group.',
      steps: ['Create 2 more groups.', 'Tap +.'], expected: 'Limit text shown; + opens the Premium offer.' },
    { id: 'UI-CST-012', title: 'Deleting a group asks for confirmation and frees a slot', priority: P2, preconditions: '3 groups.',
      steps: ['Open "QA Group 3" > edit (pencil).', 'Delete cost group > confirm.'], expected: 'Group gone; "2/3 free cost groups used".' },
  ]),

  // ───────────────────────────── UI: quiz
  ...ui('06-quiz.e2e.ts', 'Geography quiz', [
    { id: 'UI-QZ-001', title: 'Quiz list loads the bank; a free user has 5 questions today', priority: P1, preconditions: FRESH + ' Internet on.',
      steps: ['Open Quiz.'], expected: 'Worldwide row + countries; "5 of 5 free questions left today"; Answered 0.' },
    { id: 'UI-QZ-002', title: 'Choosing the right answer shows "Correct!" and the session score', priority: P1, preconditions: 'Quiz list.',
      steps: ['Search Japan > start.', 'Tap the right answer (automation looks it up in Supabase).'], expected: '"Correct!", score "1/1 correct".' },
    { id: 'UI-QZ-003', title: 'A wrong answer shows "Not quite" and highlights the right option', priority: P1, preconditions: 'Question answered.',
      steps: ['Next question.', 'Tap a wrong answer.'], expected: '"Not quite"; the right option has a green ✓ and matches the bank; "1/2 correct".' },
    { id: 'UI-QZ-004', title: 'A question left unanswered for 15 s counts as "Time\'s up!"', priority: P2, preconditions: 'Question answered.',
      steps: ['Next question.', 'Wait 16 seconds.'], expected: '"Time\'s up!" and the right option is shown.' },
    { id: 'UI-QZ-005', title: '"Report this question" sends a report that reaches Supabase', priority: P2, preconditions: 'Answered question on screen.',
      steps: ['Report this question.', 'Choose "There\'s a typo", add a note.', 'Send report.'], expected: 'Alert "Thanks! We\'ll review this question."; a row appears in quiz_reports (automation deletes it).' },
    { id: 'UI-QZ-006', title: 'The quiz tab totals answers, accuracy and free questions left', priority: P2, preconditions: '3 questions shown, 1 right.',
      steps: ['Go back to the quiz list.'], expected: 'Answered 3, Accuracy 33%, "2 of 5 free questions left today".' },
    { id: 'UI-QZ-007', title: 'After 5 questions the free quiz ends with a Premium prompt', priority: P1, preconditions: '2 free questions left.',
      steps: ['Start Worldwide, answer 2 questions, tap Next.', 'Keep playing with Premium > close.', 'Come back tomorrow.'],
      expected: '"That\'s today\'s free questions!" screen; Premium offer opens; list shows "0 of 5".' },
    { id: 'UI-QZ-010', title: 'Answer options are shuffled (the right answer is not always in the same place)', priority: P1, preconditions: '5 questions played.',
      steps: ['Note where the right answer was in each question.'], expected: 'Not all in the same position (the bank stores the right answer first).' },
    { id: 'UI-QZ-008', title: 'With no questions left, starting a quiz opens the Premium offer', priority: P2, preconditions: '0 free questions left.',
      steps: ['Start any country.'], expected: 'Premium offer opens.' },
    { id: 'UI-QZ-009', title: 'Suggesting a question asks signed-out users to sign in', priority: P3, preconditions: 'Signed out.',
      steps: ['Quiz > Suggest a question.'], expected: '"Sign in to suggest a question…" with a sign-in button.' },
  ]),

  // ───────────────────────────── UI: profile
  ...ui('07-profile.e2e.ts', 'Profile & preferences', [
    { id: 'UI-PRF-001', title: 'Signed out: profile offers sign-in and account deletion is disabled', priority: P2, preconditions: FRESH,
      steps: ['Open Profile.', 'Scroll to Danger zone.'], expected: '"Not signed in · tap to set up", "Sign in or create account"; Delete account disabled with "Sign in to manage your account."' },
    { id: 'UI-PRF-002', title: 'The traveller name is saved and survives a restart', priority: P2, preconditions: FRESH,
      steps: ['Profile > type "QA Tester" in the name.', 'Restart the app.'], expected: 'Name is still "QA Tester".' },
    { id: 'UI-PRF-003', title: 'The name is limited to 20 characters', priority: P3, preconditions: 'Profile open.',
      steps: ['Type 26 letters into the name.'], expected: 'Only the first 20 are kept.' },
    { id: 'UI-PRF-004', title: 'Choosing the Dark theme selects it', priority: P3, preconditions: 'Profile open.',
      steps: ['Theme > Dark.', 'Theme > System.'], expected: 'Dark becomes selected (app turns dark); System afterwards.' },
    { id: 'UI-PRF-005', title: 'Premium map themes open the Premium offer for free users', priority: P2, preconditions: 'Free user.',
      steps: ['Map theme > "Blue & White" (PRO).'], expected: 'Premium offer opens.' },
    { id: 'UI-PRF-006', title: 'The country count set in Profile (197) is used by the map', priority: P3, preconditions: FRESH,
      steps: ['Country count > 197.', 'Open Map.', 'Switch back to 195.'], expected: 'Map "0/197", then "0/195".' },
    { id: 'UI-PRF-007', title: 'Switching the language to Español translates the app, and back', priority: P2, preconditions: 'Profile open.',
      steps: ['Language > Español.', 'Idioma > Idioma del dispositivo.'], expected: 'Tabs in Spanish ("Perfil"); back to the device language afterwards.' },
    { id: 'UI-PRF-008', title: 'The travel timeline is Premium and opens the offer', priority: P3, preconditions: 'Free user.',
      steps: ['Profile > Timeline 🔒.'], expected: 'Premium offer opens.' },
    { id: 'UI-PRF-009', title: 'A traveller can create an avatar (stored on the phone)', priority: P3, preconditions: 'No avatar.',
      steps: ['Profile > Create your avatar.', 'Surprise me.', 'Save (choose "Use free items" if asked).'], expected: 'Back on Profile with the avatar; "Create your avatar" hint gone.' },
    { id: 'UI-PRF-010', title: 'The app version is shown at the bottom of Profile', priority: P3, preconditions: '—',
      steps: ['Scroll to the bottom of Profile.'], expected: '"Version x.y.z".' },
  ]),

  // ───────────────────────────── UI ↔ backend
  ...ui('08-account-sync.e2e.ts', 'Account & cloud sync', [
    { id: 'UI-ACC-001', title: 'Sign-in form rejects an invalid email or a short password', priority: P2, preconditions: 'Signed out.',
      steps: ['Profile > Sign in.', 'Email "not-an-email", password "short", Sign in.'], expected: 'Alert "Enter a valid email and a password of at least 8 characters."' },
    { id: 'UI-ACC-002', title: 'A wrong password shows an error and keeps the user signed out', priority: P1, preconditions: 'Test account exists.',
      steps: ['Enter the test email with a wrong password.', 'Sign in.'], expected: 'Error alert "Invalid login credentials"; form stays open.' },
    { id: 'UI-ACC-003', title: 'Signing in with email and password shows the account', priority: P1, preconditions: 'Test account exists.',
      steps: ['Enter the right password.', 'Sign in.'], expected: 'Form closes; Profile shows the email and "Sign out".', data: 'Throwaway qa-automation+… user' },
    { id: 'UI-ACC-004', title: 'A country marked in the app is saved to the cloud', priority: P1, preconditions: 'Signed in.',
      steps: ['Mark Portugal visited.', 'Check Supabase user_places.'], expected: 'Row country:PT, status visited for the user within 45 s.' },
    { id: 'UI-ACC-005', title: 'A flight added in the app is saved to the cloud', priority: P1, preconditions: 'Signed in.',
      steps: ['Add flight BA112 JFK→LHR.', 'Check Supabase trips.'], expected: 'Trip row BA112 JFK→LHR, deleted=false.' },
    { id: 'UI-ACC-006', title: 'A place saved from another device appears when the app returns to the foreground', priority: P1, preconditions: 'Signed in; Map 3/195.',
      steps: ['Insert country:BR visited for the user in Supabase.', 'Send the app to background and back.'], expected: 'Map shows 4/195.' },
    { id: 'UI-ACC-007', title: 'Signing out keeps the map on the phone', priority: P2, preconditions: 'Signed in.',
      steps: ['Profile > Sign out.', 'Open Map.'], expected: 'Profile shows "Not signed in"; Map still 4/195.' },
    { id: 'UI-ACC-008', title: '"Delete account" removes the account and its cloud data', priority: P1, preconditions: 'Signed in.',
      steps: ['Profile > Delete account > Delete.'], expected: '"Your account has been deleted."; user gone in Supabase; Map back to 0/195.' },
  ]),

  // ───────────────────────────── API
  ...backend('API', 'auth.api.test.ts', 'API · Authentication', [
    { id: 'API-AUTH-001', title: 'Email + password sign-in returns a session for that user', priority: P1, preconditions: 'Confirmed test user.', steps: ['POST /auth/v1/token?grant_type=password.'], expected: 'Session with access token; same user id and email.' },
    { id: 'API-AUTH-002', title: 'A wrong password is rejected', priority: P1, preconditions: 'Test user.', steps: ['Sign in with a wrong password.'], expected: '400 invalid_credentials, no session.' },
    { id: 'API-AUTH-003', title: 'An unknown email gets the same error (no account enumeration)', priority: P2, preconditions: '—', steps: ['Sign in with an unknown email.'], expected: '400 invalid_credentials.' },
    { id: 'API-AUTH-004', title: 'The access token identifies the user', priority: P2, preconditions: 'Signed in.', steps: ['GET /auth/v1/user.'], expected: 'Returns the same user id.' },
    { id: 'API-AUTH-005', title: 'After sign-out the client no longer reads private data', priority: P2, preconditions: 'User with 1 place.', steps: ['Sign out.', 'Select user_places.'], expected: 'No rows.' },
    { id: 'API-AUTH-006', title: 'Signed-out visitors see no rows in any private table', priority: P1, preconditions: '—', steps: ['Select profiles, user_places, trips, user_docs, quiz_reports, quiz_suggestions with the public key.'], expected: 'All empty.' },
  ]),
  ...backend('API', 'quiz.api.test.ts', 'API · Quiz', [
    { id: 'API-QUIZ-001', title: 'Anyone can read the question bank and it is not empty', priority: P1, preconditions: '—', steps: ['Count active quiz_questions with the public key.'], expected: '> 10,000 questions.' },
    { id: 'API-QUIZ-002', title: 'Bank downloads in pages of 1000 ordered by updated_at', priority: P2, preconditions: '—', steps: ['Fetch range 0–999 and 1000–1999 ordered by updated_at.'], expected: 'Full first page, non-empty second, ascending timestamps.' },
    { id: 'API-QUIZ-003', title: 'Incremental sync after the newest updated_at returns nothing', priority: P2, preconditions: '—', steps: ['Query updated_at > newest.'], expected: 'Empty list.' },
    { id: 'API-QUIZ-004', title: "App users cannot add, change or delete questions", priority: P1, preconditions: 'Public key and a signed-in user.', steps: ['Insert, update and delete a question.'], expected: 'Insert refused; update/delete affect 0 rows.' },
    { id: 'API-QUIZ-005', title: 'Anyone can report a question but cannot read reports back', priority: P2, preconditions: '—', steps: ['Insert a report anonymously.', 'Select it back.'], expected: 'Insert OK; select returns nothing; stored with user_id null.' },
    { id: 'API-QUIZ-006', title: 'A user can report as themselves but not as someone else', priority: P2, preconditions: 'Two users.', steps: ['Insert with own user_id.', 'Insert with the other user\'s id.'], expected: 'First OK, second refused.' },
    { id: 'API-QUIZ-007', title: 'A report for a question that does not exist is rejected', priority: P3, preconditions: '—', steps: ['Insert a report for "no-such-question".'], expected: 'Foreign-key error 23503.' },
    { id: 'API-QUIZ-008', title: 'Only signed-in users can suggest questions; suggestions are not readable', priority: P2, preconditions: 'User.', steps: ['Insert anonymously.', 'Insert as user.', 'Select back.'], expected: 'Anonymous refused, user OK (status pending), nothing readable.' },
    { id: 'API-QUIZ-009', title: "A suggestion cannot be filed in another user's name", priority: P2, preconditions: 'Two users.', steps: ['Insert with the other user\'s id.'], expected: 'Refused.' },
  ]),
  ...backend('API', 'sync.api.test.ts', 'API · Cloud sync', [
    { id: 'API-SYNC-001', title: 'Place marks round-trip (upsert on user_id,key)', priority: P1, preconditions: 'User A.', steps: ['Upsert 3 marks.', 'Read back.'], expected: 'Same rows returned.' },
    { id: 'API-SYNC-002', title: 'Saving the same place again updates it (last write wins; removal = null)', priority: P1, preconditions: 'Marks saved.', steps: ['Upsert country:JP with status null and a later time.'], expected: 'One row, status null, new time.' },
    { id: 'API-SYNC-003', title: 'Trips round-trip with all fields', priority: P1, preconditions: 'User A.', steps: ['Upsert a full trip.', 'Read back.'], expected: 'Identical row.' },
    { id: 'API-SYNC-004', title: 'Deleting a trip is a tombstone (deleted=true) that syncs', priority: P2, preconditions: 'Trip saved.', steps: ['Update deleted=true.'], expected: 'Row kept with deleted=true.' },
    { id: 'API-SYNC-005', title: 'Cost groups and quiz progress round-trip as JSON documents', priority: P1, preconditions: 'User A.', steps: ['Upsert a cost_group and quiz doc.', 'Read back.'], expected: 'JSON identical.' },
    { id: 'API-SYNC-006', title: 'The profile (name and preferences) round-trips', priority: P2, preconditions: 'User A.', steps: ['Upsert profile.', 'Read back.'], expected: 'Identical.' },
    { id: 'API-SYNC-007', title: 'A pull with the cursor returns only rows changed after it', priority: P1, preconditions: 'Several marks.', steps: ['Select updated_at > oldest.'], expected: 'Only newer rows.' },
    { id: 'API-SYNC-008', title: "Another user cannot see any of the first user's data", priority: P1, preconditions: 'Users A and B.', steps: ['As B select every table.'], expected: 'All empty.' },
    { id: 'API-SYNC-009', title: "Another user cannot write into or change the first user's data", priority: P1, preconditions: 'Users A and B.', steps: ['As B insert with A\'s id, update A\'s trip, delete A\'s places.'], expected: 'Insert refused (42501); update/delete 0 rows; A\'s data intact.' },
  ]),
  ...backend('API', 'delete-account.api.test.ts', 'API · Delete account', [
    { id: 'API-DEL-001', title: 'Answers the CORS preflight', priority: P3, preconditions: 'Function deployed.', steps: ['OPTIONS /functions/v1/delete-account.'], expected: '200 with Access-Control-Allow-Origin *.' },
    { id: 'API-DEL-002', title: 'Rejects methods other than POST', priority: P3, preconditions: 'Function deployed.', steps: ['GET with a token.'], expected: '405.' },
    { id: 'API-DEL-003', title: 'Rejects a request without a user token', priority: P1, preconditions: 'Function deployed.', steps: ['POST without Authorization.'], expected: '401 and the user still exists.' },
    { id: 'API-DEL-004', title: 'Rejects a forged token', priority: P1, preconditions: 'Function deployed.', steps: ['POST with "Bearer not-a-real-token".'], expected: '401.' },
    { id: 'API-DEL-005', title: "Deletes the caller's account together with all their cloud data", priority: P1, preconditions: 'User with place, trip, profile.', steps: ['POST with the user\'s token.'], expected: '200 {deleted:true}; user and rows gone.' },
  ]),
  ...backend('API', 'external.api.test.ts', 'API · External services', [
    { id: 'API-EXT-001', title: "Exchange rates (open.er-api.com) return today's USD rates", priority: P2, preconditions: 'Internet.', steps: ['GET /v6/latest/USD.'], expected: 'success, EUR/JPY/GBP/CRC/MXN > 0, updated < 3 days ago.' },
    { id: 'API-EXT-002', title: "Wikidata returns a UNESCO site's article in the user's language", priority: P3, preconditions: 'Internet.', steps: ['wbgetentities Q676203 eswiki.'], expected: 'Spanish title present.' },
    { id: 'API-EXT-003', title: 'Wikipedia returns a summary for a UNESCO site', priority: P3, preconditions: 'Internet.', steps: ['GET page/summary/Machu_Picchu.'], expected: 'Extract longer than 50 chars.' },
    { id: 'API-EXT-004', title: 'Website Terms page linked from Profile is online', priority: P2, preconditions: 'Internet.', steps: ['GET https://getworldly.app/en/terms/.'], expected: '200 HTML.' },
    { id: 'API-EXT-005', title: 'Website Privacy page linked from Profile is online', priority: P1, preconditions: 'Internet.', steps: ['GET https://getworldly.app/en/privacy/.'], expected: '200 HTML.' },
    { id: 'API-EXT-006', title: 'Website Credits page linked from Profile is online', priority: P3, preconditions: 'Internet.', steps: ['GET https://getworldly.app/en/credits/.'], expected: '200 HTML.' },
  ]),

  // ───────────────────────────── DB
  ...backend('DB', 'constraints.db.test.ts', 'DB · Constraints', [
    { id: 'DB-CON-001', title: 'Place keys must be <country|region|city|airport|unesco>:<code>', priority: P2, preconditions: 'User.', steps: ['Insert valid and invalid keys.'], expected: 'Valid accepted; "planet:MARS", "FR", "country:" rejected (23514).' },
    { id: 'DB-CON-002', title: 'A place status is visited, want, or null', priority: P2, preconditions: 'User.', steps: ['Insert want, null, "maybe".'], expected: '"maybe" rejected.' },
    { id: 'DB-CON-003', title: 'Trip times must be HH:MM', priority: P3, preconditions: 'User.', steps: ['Insert 09:05 and 9:05, 0905, noon.'], expected: 'Only 09:05 accepted.' },
    { id: 'DB-CON-004', title: 'Trip cabin class from the allowed list', priority: P3, preconditions: 'User.', steps: ['Insert each class and "luxury".'], expected: '"luxury" rejected.' },
    { id: 'DB-CON-005', title: 'Trip text limits (flight number, seat, notes, airport codes)', priority: P3, preconditions: 'User.', steps: ['Insert values at and over each limit.'], expected: 'At-limit accepted; over-limit rejected.' },
    { id: 'DB-CON-006', title: 'Profile: name ≤ 20, theme and count from allowed lists', priority: P3, preconditions: 'User.', steps: ['Upsert 20/21-char names, theme "sepia", count "200".'], expected: 'Only valid values accepted.' },
    { id: 'DB-CON-007', title: 'Synced documents are only cost groups or quiz progress', priority: P3, preconditions: 'User.', steps: ['Insert doc types cost_group, quiz, photos.'], expected: '"photos" rejected.' },
    { id: 'DB-CON-008', title: 'Question reports: reason from the list, note ≤ 300', priority: P3, preconditions: 'User.', steps: ['Insert valid, reason "spam", long note.'], expected: 'Invalid ones rejected.' },
    { id: 'DB-CON-009', title: 'Suggestions: question 5–300 chars, answer 1–150', priority: P3, preconditions: 'User.', steps: ['Insert valid, too short, too long, empty answer.'], expected: 'Invalid ones rejected.' },
    { id: 'DB-CON-010', title: 'Quiz questions need 4 options, answer 0–3 and a known category', priority: P2, preconditions: 'Service key.', steps: ['Insert (inactive) valid and invalid questions.'], expected: 'Invalid ones rejected.' },
  ]),
  ...backend('DB', 'lifecycle.db.test.ts', 'DB · Cascades & triggers', [
    { id: 'DB-CAS-001', title: 'Deleting a user deletes their places, trips, documents, profile and suggestions', priority: P1, preconditions: 'User with data in every table.', steps: ['Delete the user.', 'Count rows.'], expected: 'All counts 0 (GDPR / Ley 8968 erasure).' },
    { id: 'DB-CAS-002', title: 'Deleting a user keeps their reports but unlinks them', priority: P3, preconditions: 'User with a report.', steps: ['Delete the user.'], expected: 'Report kept with user_id null.' },
    { id: 'DB-TRG-001', title: 'Changing a quiz question bumps updated_at so apps download the change', priority: P2, preconditions: 'Service key.', steps: ['Insert, wait 1 s, update.'], expected: 'updated_at increases.' },
  ]),
  ...backend('DB', 'quiz-bank.db.test.ts', 'DB · Quiz bank content', [
    { id: 'DB-DAT-001', title: 'Every question has 4 different, non-empty options', priority: P1, preconditions: '—', steps: ['Download the bank.'], expected: 'No question breaks the rule.' },
    { id: 'DB-DAT-002', title: 'Every question has a valid answer index and an explanation', priority: P1, preconditions: '—', steps: ['Check answer and explanation.'], expected: 'All valid.' },
    { id: 'DB-DAT-003', title: "Every question belongs to Worldwide or one of the app's 197 countries", priority: P2, preconditions: '—', steps: ['Check cc codes.'], expected: 'No unknown codes.' },
    { id: 'DB-DAT-004', title: 'Every country has ≥ 30 questions and Worldwide ≥ 100', priority: P2, preconditions: '—', steps: ['Count per country.'], expected: 'No country below the minimum.' },
    { id: 'DB-DAT-005', title: 'No country repeats the same question', priority: P2, preconditions: '—', steps: ['Look for duplicate texts per country.'], expected: 'None.' },
    { id: 'DB-DAT-006', title: 'Questions are well-formed (end with ?, 10–200 chars, short explanation)', priority: P3, preconditions: '—', steps: ['Check lengths and punctuation.'], expected: 'All valid.' },
    { id: 'DB-DAT-007', title: 'All four categories are used', priority: P3, preconditions: '—', steps: ['List categories.'], expected: 'history, geography, politics, culture.' },
  ]),

  // ───────────────────────────── Manual-only
  ...manual('Purchases', 'UI', [
    { id: 'MAN-PUR-001', title: 'Buying Premium on Google Play unlocks every Premium feature and stops the launch offer', priority: P1, preconditions: 'Play Store build, license-tester account, free user.',
      steps: ['Tap "Get Premium for $6".', 'Complete the test purchase.', 'Restart the app.'], expected: '"Premium is active", PRO badge; globe, regions, themes, timeline unlocked; no offer on launch.' },
    { id: 'MAN-PUR-002', title: 'Restore purchases on a new phone restores Premium', priority: P1, preconditions: 'Account that already bought Premium; reinstalled app.',
      steps: ['Offer screen > Restore purchases.'], expected: '"Purchases restored", Premium active.' },
    { id: 'MAN-PUR-003', title: 'Restore with no previous purchase', priority: P3, preconditions: 'Never bought.', steps: ['Profile > Restore purchases.'], expected: '"No previous purchases found".' },
    { id: 'MAN-PUR-004', title: 'Cancelled purchase leaves the user free and shows no error', priority: P2, preconditions: 'Free user.', steps: ['Start buying, cancel in the Play dialog.'], expected: 'Back on the offer, still free.' },
  ]),
  ...manual('Accounts', 'UI', [
    { id: 'MAN-ACC-001', title: 'Continue with Google signs in and syncs', priority: P1, preconditions: 'Google account on the phone.', steps: ['Profile > Sign in > Continue with Google.', 'Pick the account.'], expected: 'Signed in with the Google email; data syncs.' },
    { id: 'MAN-ACC-002', title: 'Create account sends a confirmation email', priority: P2, preconditions: 'New email address you can read.', steps: ['Create account tab, email + 8-char password.'], expected: '"Check your email to confirm…"; link in the email confirms.' },
    { id: 'MAN-ACC-003', title: 'Forgot password sends a reset email', priority: P2, preconditions: 'Existing account.', steps: ['Sign in > Forgot password?'], expected: '"Check your email…"; reset link works.' },
    { id: 'MAN-ACC-004', title: 'Two phones with the same account end up with the same data', priority: P1, preconditions: 'Two devices.', steps: ['Mark different countries on each.', 'Reopen both.'], expected: 'Both show the union of marks; removals sync too.' },
  ]),
  ...manual('Route videos', 'UI', [
    { id: 'MAN-VID-001', title: 'Create a route video from my flights and export it (free: 720p + watermark, ≤ 5 routes)', priority: P1, preconditions: 'Dev/store build; ≥ 1 flight.',
      steps: ['Travel > Route videos > From my flights.', 'Preview.', 'Export.'], expected: 'MP4 saved to the gallery, 720p, "Made with Worldly" watermark; > 5 routes asks for Premium.' },
    { id: 'MAN-VID-002', title: 'Premium video: 1080p, no watermark, up to 100 routes', priority: P2, preconditions: 'Premium.', steps: ['Export a video with 20 routes.'], expected: '1080p, no watermark.' },
    { id: 'MAN-VID-003', title: 'Real Earth style and stop photos', priority: P3, preconditions: '—', steps: ['Choose "Real Earth", add a photo to a stop, preview.'], expected: 'NASA Blue Marble background, photo shown at the stop.' },
  ]),
  ...manual('Sharing & system', 'UI', [
    { id: 'MAN-SYS-001', title: 'Share my map image through WhatsApp/Instagram', priority: P2, preconditions: '—', steps: ['Stats > Share my map > Share.'], expected: 'Android share sheet; image arrives correctly.' },
    { id: 'MAN-SYS-002', title: 'Cost summary image: preview for free, sharing for Premium', priority: P2, preconditions: 'Group with expenses.', steps: ['Group > Share summary.'], expected: 'Free: preview + "Get Premium to share"; Premium: share sheet.' },
    { id: 'MAN-SYS-003', title: 'Home-screen widget shows countries and world %', priority: P2, preconditions: 'Premium; widget added.', steps: ['Add the Worldly widget.', 'Mark a country.'], expected: 'Widget updates; free users see the locked widget.' },
    { id: 'MAN-SYS-004', title: 'Arabic switches the layout to right-to-left after restart', priority: P3, preconditions: '—', steps: ['Language > العربية.', 'Restart.'], expected: 'Restart prompt; RTL layout.' },
    { id: 'MAN-SYS-005', title: 'Offline: map, places, trips, costs and cached quiz work without internet', priority: P1, preconditions: 'Quiz opened once online.', steps: ['Airplane mode.', 'Use each feature.'], expected: 'Everything works; sync resumes when online.' },
    { id: 'MAN-SYS-006', title: 'Legal pages open in the browser in the app language', priority: P2, preconditions: 'Language Español.', steps: ['Profile > Terms / Privacy / Credits.'], expected: 'getworldly.app/es/… pages open.' },
    { id: 'MAN-SYS-007', title: 'Contact us opens the email app (or shows the address)', priority: P3, preconditions: '—', steps: ['Profile > Contact us.'], expected: 'Email to support@getworldly.app with subject; or alert with the address.' },
    { id: 'MAN-SYS-008', title: 'Updating the app keeps all local data', priority: P1, preconditions: 'Older build with data.', steps: ['Install the new build over it.'], expected: 'Places, trips, costs, avatar, quiz progress intact.' },
    { id: 'MAN-SYS-009', title: 'Premium 3D globe rotates and selects countries', priority: P2, preconditions: 'Premium.', steps: ['Map > Globe.', 'Drag and tap a country.'], expected: 'Smooth rotation; country card opens.' },
    { id: 'MAN-SYS-010', title: 'Visit date picker sets and clears the date; timeline lists it', priority: P3, preconditions: 'Premium; visited country.', steps: ['Country > Date visited > pick a date.', 'Profile > Timeline.'], expected: 'Date saved; country listed in the timeline.' },
  ]),
];
