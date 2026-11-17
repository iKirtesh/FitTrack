# FitTrack development log

Offline-first fitness tracker. One Expo SDK 58 codebase for Android, iOS and web. SQLite (via `expo-sqlite` + Drizzle) is the only data store. No accounts, no backend.

## How to run

```bash
npm install --legacy-peer-deps
npm run typecheck && npm test        # 64 unit/integration/config tests
npm start                            # Expo dev server (press w for web, or use a dev build on a device)
npm run build:web && npm run serve:web   # production web build served with the required headers
npm run e2e:web                      # quick headless-browser smoke test against the served build
npm run e2e:web:full                 # broad browser suite (every major screen, backup/delete/restore round-trip)
```

Schema changes: edit `src/database/schema/*`, run `npm run db:generate`, commit the generated migration. Never edit an applied migration.

## Status by phase

| Phase | State |
|---|---|
| 1-2 Analysis, architecture | Done (summarised in the project chat) |
| 3 Foundation (Expo, TS strict, Router, SQLite, migrations, theme, components, profile) | Done |
| 4 Core features (workouts, exercise library, running, cardio, counters, plans, measurements) | Done |
| 5 Intelligence (PRs, analytics, charts, achievements, goals) | Done |
| 6 Data management (JSON backup, CSV, restore, deletion, app lock) | Done |
| 7 QA | Automated tests and a broad web browser suite done; **no Android or iOS device testing yet** (needs a device or EAS build) |
| 8 Production | Config added (`eas.json`, `vercel.json`); **no store builds have been made** |

## Completed features

- Profile with all requested fields, edit any time, photo stored locally.
- 126 hand-written exercises (text instructions + an original front/back muscle-map illustration highlighting primary and secondary muscles), search/filter, custom exercises. Tracking types: weight+reps, bodyweight reps, assisted, timed, distance, duration.
- Workouts: add/edit/reorder/duplicate/delete exercises, sets with previous-performance prefill, rest timer, RPE, notes, undo for deleted sets/exercises, crash-safe (active workout lives in SQLite), PR detection on finish.
- Running/walking: manual entry and live foreground GPS tracking (pause/resume, accuracy indicator, route, per-km splits, elevation, resume after app restart).
- Cardio logging, activity counters (built-in and custom, daily targets, weekly/monthly stats, undo), steps (manual, plus pedometer on mobile), water.
- Plans: 5 templates, custom plans, duplicate, activate, start a workout from a plan day, calendar with completed/missed/planned days.
- Measurements (all requested fields, photo, notes), BMI (labelled calculated), weight trend and 7/30-day change, goals with real progress.
- Analytics with 7D/30D/90D/6M/1Y/All ranges, personal records, 21 achievements that state their exact rules.
- Backup: complete JSON export, CSV export (workouts per set, runs, cardio, measurements), validated and atomic restore (merge or replace, duplicate detection), clear history, delete profile, delete everything. App-lock PIN is never exported.
- Dark/light/system themes, customisable dashboard cards, reminders, optional app lock.

## Test results

- `npm test`: 64 passing. Database/migrations/FK/seed, repositories, workout lifecycle, calculations, GPS maths, records/achievements/analytics, backup round-trip/atomicity/validation/deletion, **navigation** (every declared screen has a file; every literal route target resolves; five tabs present) and **platform config** (iOS/Android permission strings, no background-location permissions, web isolation headers and worker, native APIs guarded).
- `npm run typecheck`: clean (strict mode, `noUncheckedIndexedAccess`).
- `npm run e2e:web:full` against the production web build in headless Chromium: all checks pass. Covers onboarding, profile edit persistence, manual run (pace, PR records), cardio, counters (increment, undo, custom, persistence), plan template + activate + calendar, goals, measurements + BMI, progress, achievements, theme, reminders, app lock (wrong PIN rejected, correct PIN unlocks, can be turned off), exercise illustration, JSON export download (valid, no lock secrets), CSV download, **delete-all returns to onboarding, restore from the downloaded file brings back profile, records, plans and counters**.
- `npm run e2e:web`: 8/8 cold starts open the database; workout with PR and history persists.
- Not covered: native rendering and navigation (no device), notifications actually firing, the GPS screen with a real location fix, component-level UI tests.

### Bugs found by browser testing and fixed
- Values typed into set rows were lost on web (`onEndEditing` never fires in react-native-web): now committed on blur/submit.
- Onboarding bounced back to itself (cached "no profile" redirect): layout now waits for the refetch.
- Web SQLite: worker timeout on startup, missing `/worker`, intermittent first-migration failure (retry added).
- Plans list: buttons inside a pressable card also triggered the card on web, so "Set active" navigated instead of activating: only the title area is pressable now.

## Known limitations (please read)

1. **Not tested on Android or iOS devices or simulators.** The native code paths (SecureStore app lock, notifications, pedometer, GPS permissions, file sharing) are written against the Expo APIs but unverified. Do this before releasing.
2. **GPS is foreground-only.** Background location tracking is not implemented, and the app does not claim it. If the app is backgrounded or the screen locks, fixes may stop and that stretch is not recorded. Real-device GPS accuracy has not been tested; the filtering/split maths is unit-tested with synthetic points only.
3. **Web:** step counting, scheduled notifications and background location do not exist. The app lock PIN is held in browser storage, which is weak protection (labelled in Settings). Browser GPS works only while the tab is open.
4. **Web SQLite workarounds** (all in `src/database/client.ts`, scripts/ and `vercel.json`): the SQLite worker is requested at `/worker`, which Metro does not emit, so `build:web` copies it there; the host must send `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` and serve `/worker` as JavaScript; the worker is warmed up with an async open before sync calls; migrations are retried up to 4 times because the first transaction on a brand-new browser database failed intermittently (about 3 in 8 cold starts before the retry). The root cause inside the WASM driver was not identified. Browser data can be cleared by the user or by the browser under storage pressure; export backups.
5. Exercise illustrations are a simplified original muscle map, not per-exercise movement photos or animations (the schema supports `image_uri` for those).
6. Calorie figures are MET-based **estimates** and are labelled as such. Estimated 1RM (Epley) is labelled and only shown for 12 reps or fewer. BMI is a screening ratio.
7. A pause during GPS tracking is held in memory; if the app is killed mid-activity, the time since the last saved fix is treated as paused when you resume.
8. Apple Health / Health Connect integration is not implemented (listed as a future option in the brief).
9. Dependencies are installed with `--legacy-peer-deps`.

## Pending / next steps

- Test on real Android and iOS devices (permissions, notifications, GPS, share sheet, app lock) and fix what breaks.
- Build with EAS (`eas build --profile preview`), fill in app-store metadata and privacy declarations (location, photos).
- Add component-level UI tests (Jest + Testing Library) and native end-to-end tests (e.g. Maestro) once devices are available.
- Find the root cause of the first-run web migration failure and remove the retry if possible.
- Optional: background location, exercise illustrations, health-platform sync.

## Architecture notes

- `src/database/schema` tables, `migrations` generated SQL, `repositories` one per domain (written once against a synchronous Drizzle type so the same code runs on expo-sqlite and better-sqlite3 in tests), `client.ts` open/migrate/seed.
- Storage conventions: UUID text keys, epoch-ms timestamps, local days as `YYYY-MM-DD`, weights in kg, distances in metres, units converted only at the UI edge.
- Business logic lives in `src/services` and repositories; screens in `src/app` (Expo Router) call repositories through hooks in `src/hooks`.
- Personal records are derived from recorded data and rebuilt after changes, so deleting data can never leave a stale record.
