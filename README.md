# Worldly — Appium test suite

End-to-end tests for the **Worldly** Android app (`app.getworldly`), written in **TypeScript** with
**WebdriverIO 10 + Appium 3 (UiAutomator2)**, plus **API** and **database** tests against the
app's Supabase backend.

| Layer | What it covers | Runner | Count |
|---|---|---|---|
| UI (`tests/ui`) | Paywall, navigation, map & explore, country pages, stats, flights, travel costs, quiz, profile, sign-in and cloud sync | WebdriverIO + Appium | 72 |
| API (`tests/api`) | Auth, quiz bank / reports / suggestions, sync endpoints and Row Level Security, `delete-account` function, external services | Mocha | 35 |
| DB (`tests/db`) | Constraints, cascades on account deletion, triggers, quiz-bank data quality | Mocha | 20 |
| Manual | Purchases, Google sign-in, route-video export, widgets, offline, upgrades… | `docs/Worldly-Test-Cases.xlsx` | 21 |

Every case has an ID (e.g. `UI-CST-005`) that appears in the test title, in the Excel tracker
(`docs/Worldly-Test-Cases.xlsx`) and in the reports.

---

## 1. One-time setup (Windows)

1. **Node 20+** and **Java 17** (`JAVA_HOME` set; only needed to convert store `.aab` builds).
2. **Android SDK** with `platform-tools` (adb). Android Studio installs it, or the command-line tools.
3. In this folder:
   ```bash
   npm install
   npm run appium:install-driver      # UiAutomator2 driver, kept inside .appium/
   cp .env.example .env               # then fill it in (see below)
   ```
4. `.env` values:
   | Name | Where to get it |
   |---|---|
   | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | same as `EXPO_PUBLIC_…` in the app's `.env` |
   | `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API keys (secret). Only used to create/delete throwaway test users. **Never commit it.** |
   | `ANDROID_HOME` | e.g. `C:\Users\<you>\AppData\Local\Android\Sdk` |
   | `APP_PATH` | APK to install before the run (`apps/worldly.apk`). Empty = test the Worldly already installed. |
   | `ALLOW_APP_DATA_RESET` | must be `true` to run on a real phone (see the warning below) |

5. Get the app build: `npx eas-cli login` once, then
   ```bash
   npm run app:download                         # newest "preview" APK from EAS → apps/worldly.apk
   npm run app:download -- --profile production # newest store AAB, converted to a universal APK
   ```

## 2. Run on your Android phone

> ⚠️ **Every UI spec wipes Worldly's data on the device** (like a fresh install) so tests don't
> depend on each other. On a phone with your real Worldly data, back it up first (sign in so it
> syncs) — or use an emulator. The suite refuses to run on a physical phone until you set
> `ALLOW_APP_DATA_RESET=true`.
>
> The EAS preview APK and the Play Store app have the same package name but different signing
> keys: Android won't install one over the other. Uninstall the other one first, or leave
> `APP_PATH` empty to test whatever is installed.

1. On the phone: **Settings → About phone → tap "Build number" 7 times**, then **Developer options
   → USB debugging ON** (on Xiaomi also "USB debugging (Security settings)").
2. Connect the USB cable and accept the "Allow USB debugging?" prompt. Check with
   `%ANDROID_HOME%\platform-tools\adb devices` — the phone must say `device`.
3. Run and watch the phone — Appium opens Worldly and taps through each flow:
   ```bash
   npm run test:ui:smoke                                 # 3 short specs (~5 min)
   npm run test:ui                                       # everything
   npm run test:ui:spec -- tests/ui/05-costs.e2e.ts      # one spec
   npx wdio run wdio.conf.ts --suite quiz                # suites: smoke, places, travel, quiz, account
   npx wdio run wdio.conf.ts --mochaOpts.grep "UI-CST-005"   # one test (its spec's earlier steps still run)
   ```
   The suite reads the phone's language and uses the app's own translations, so it works with
   the phone in Spanish too (or force one with `APP_LANGUAGE=en`). During the session Appium swaps
   in an invisible keyboard; your normal keyboard comes back at the end.

## 3. Run on an emulator (this PC)

An AVD named `worldly_api28` (Android 9, x86) is already set up here:
```bash
"%ANDROID_HOME%\emulator\emulator.exe" -avd worldly_api28
npm run test:ui
```
Any x86/x86_64 image with Google APIs works (API 28–35).

## 4. API and database tests

No phone needed:
```bash
npm run test:backend      # API + DB (or test:api / test:db)
```
They create confirmed throwaway users (`qa-automation+…@getworldly.app`, no email is sent) and
delete them afterwards; reports and suggestions they file are marked `[qa-automation]` and
removed. `npm run cleanup:test-users` sweeps anything left by an interrupted run.

## 5. Twice a day, automatically

Two GitHub Actions workflows in `.github/workflows`:

| Workflow | When (Costa Rica time) | What |
|---|---|---|
| **API & database tests** | 05:00 and 17:00 (+ on every push to `main`) | `npm run test:backend` |
| **Android UI tests (emulator)** | 05:30 and 17:30 | downloads the newest EAS preview APK, boots an Android 13 emulator, runs all UI specs |

Both can also be started by hand (Actions tab → workflow → **Run workflow**; the UI one lets you
pick a suite and the EAS build profile). Each run shows a results table in its summary and keeps
`reports/` (JUnit XML, failure screenshots + page source) as a downloadable artifact for 30 days.
GitHub emails you when a scheduled run fails.

**Repository secrets needed** (Settings → Secrets and variables → Actions → New repository secret):

| Secret | Value |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | public anon key |
| `SUPABASE_SECRET_KEY` | secret / service-role key |
| `EXPO_TOKEN` | expo.dev → Account settings → Access tokens → create a token (lets CI download the APK) |

**Alternative: run on this PC** with Windows Task Scheduler (opens the emulator if no phone is
connected, runs everything, updates the Excel file, logs to `reports/history`):
```powershell
powershell -ExecutionPolicy Bypass -File scripts\windows\register-task.ps1 -Times 07:00,19:00
```

## 6. Test case tracker (Excel)

`docs/Worldly-Test-Cases.xlsx` is generated from `testcases/catalog.ts`:

- **Summary** — totals and pass rate per area (formulas).
- **Test Cases** — ID, area, layer, priority, preconditions, numbered steps, expected result,
  the spec that automates it, the last automated result, and yellow columns for manual runs.
- **Manual Run Log** — one row per manual execution.
- **How to run** — the short version of this README.

Refresh it after a run (manual columns you typed are kept):
```bash
npm run report:summary && npm run testcases:excel
```
Adding a test: add it to `testcases/catalog.ts` and put the same `[ID]` in the test title —
`npm run testcases:excel` fails if the two get out of sync.

## 7. How it's built

```
config/env.ts            settings from .env
wdio.conf.ts             Appium capabilities, device checks, reports, failure screenshots
src/support/strings.ts   the app's translations (fixtures/app-data) → selectors in any language
src/support/selectors.ts UiAutomator selector builders
src/support/supabase.ts  throwaway users, admin checks, polling
src/pages/*.ts           page objects (one per screen) and shared flows
tests/ui|api|db          specs
testcases/catalog.ts     every test case (automated + manual) → Excel
scripts/                 app download, Excel builder, report summary, cleanup, Windows schedule
```

Notes:
- The app has no `testID`s; selectors use the accessibility labels and texts React Native
  exposes. Adding `testID`s to key controls in the app would make tests even sturdier.
- Taps on the Skia world map are computed from the same Mercator projection the app uses, so
  they hit the right country on any screen size.
- After the app's texts change, run `npm run sync:app-data -- ../worldly` to refresh
  `fixtures/app-data`.
- Each UI spec starts from cleared app data, so specs are independent; tests inside a spec build
  on each other in order (e.g. create a group → add an expense → settle up).
