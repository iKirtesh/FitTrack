# Install FitTrack on an Android phone

## Option 1: download the APK from GitHub (no computer needed)

1. Open <https://github.com/iKirtesh/FitTrack/releases> on your phone.
2. Open the newest release and download **`FitTrack-latest.apk`**.
3. Open the downloaded file. If Android asks, allow **Install unknown apps** for your browser, then tap **Install**.
4. Open FitTrack, create your profile, and allow location only when you start tracking a run.

Updates: install a newer APK over the old one. Your data is kept because every build is signed with the same key.
Back up first (Profile > Backup & restore > Export) before uninstalling, because uninstalling removes the app's data.

If there is no release yet, go to **Actions > Build Android APK > Run workflow**. The first build takes about 15-25 minutes.

## Option 2: build it yourself with EAS (Expo account required)

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview   # prints a download link to an installable APK
```

## Option 3: build locally

Needs JDK 17 and the Android SDK.

```bash
npm install --legacy-peer-deps
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
# APK: android/app/build/outputs/apk/release/app-release.apk
```

## Notes

- These APKs use the standard Expo debug signing key. That is fine for installing on your own phone; for the Play Store you need your own upload key (use `eas build --profile production`).
- GPS tracking works while the app is open; background tracking is not implemented.
- This build has not been tested on a physical phone yet. Report anything that breaks.
