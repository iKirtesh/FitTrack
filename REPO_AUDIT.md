# FitTrack repository audit — Android build preparation

Audit date: 2026-11-16
Audited branch: `main`
Preparation branch: `chore/android-build-preparation`

## What is already present

- Expo SDK 58, React Native 0.88, TypeScript and Expo Router.
- Root layout and tab layout.
- Existing home, workouts and activity tab screens.
- Profile onboarding and profile edit screens.
- Workout active/detail screens and exercise library screens.
- Manual cardio and run entry screens.
- SQLite + Drizzle schema, migration SQL, migration metadata and repositories.
- DatabaseProvider in `src/hooks/data.tsx`.
- App icon, Android adaptive icon assets and web favicon.
- Android package ID: `dev.ikirtesh.fittrack`.

This corrects the earlier preliminary assessment: the repository already contains substantial UI and data-layer code. It is not accurate to describe it as having no screens or no database provider.

## Important route gaps found

The root stack and tab navigator reference route files that are not currently present on `main`.

Missing tab files:
- `src/app/(tabs)/progress.tsx`
- `src/app/(tabs)/profile.tsx`

Missing stack route files referenced by `src/app/_layout.tsx`:
- `src/app/run/track.tsx`
- `src/app/run/[id].tsx`
- `src/app/plans/index.tsx`
- `src/app/plans/[id].tsx`
- `src/app/measurements.tsx`
- `src/app/records.tsx`
- `src/app/achievements.tsx`
- `src/app/calendar.tsx`
- `src/app/goals.tsx`
- `src/app/settings.tsx`
- `src/app/backup.tsx`

Some navigation actions also point to these routes. The route registrations should be reconciled with implemented screens before calling the app complete or distributing a test APK. Do not mask these gaps with fake placeholder features.

## Build preparation added on this branch

- `eas.json`: Android development APK, standalone preview APK, and production AAB profiles.
- `ANDROID_BUILD.md`: first-time Expo account setup, project linking, dev-client installation, validation and build commands.

## Required before EAS builds

1. Create/sign in to a free Expo account.
2. Run `npx expo install expo-dev-client` and commit the dependency and lockfile updates.
3. Run `npx eas-cli@latest login` and `npx eas-cli@latest init` to link this repository to the Expo account. The project ID is account-specific and was intentionally not invented or committed.
4. Resolve missing route registrations/screens.
5. Run Expo dependency checks, TypeScript, tests and a real Android build.

## Validation status

No Android APK was generated during this repository preparation. This environment can update the GitHub repository but does not have the owner's Expo login, EAS project ID, Android signing credentials, or an authenticated EAS build session. A successful cloud build and device installation therefore remain unverified.
