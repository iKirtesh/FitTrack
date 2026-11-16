# Android builds

FitTrack uses Expo SDK 58 and EAS Build. The repository is configured for three Android build types:

| Profile | Output | Purpose |
| --- | --- | --- |
| `development` | APK | Development client with developer tools; connects to the Metro bundler |
| `preview` | APK | Standalone installable build for device testing |
| `production` | AAB | Google Play distribution |

## One-time setup

Use Node.js **22.13 or newer** (required by Expo SDK 58), npm, and Git.

1. Create a free account at https://expo.dev/signup.
2. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/iKirtesh/FitTrack.git
   cd FitTrack
   npm install
   ```

3. Install the SDK-compatible development client and commit the generated dependency/lockfile changes:

   ```bash
   npx expo install expo-dev-client
   ```

4. Sign in and link this checkout to the Expo project:

   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest init
   ```

   During initialization, keep the existing Android application ID: `dev.ikirtesh.fittrack`. EAS will add the project ID to the Expo app config. Commit that generated config change.

5. Validate the project before building:

   ```bash
   npx expo install --check
   npx expo-doctor
   npm run typecheck
   npm test -- --runInBand
   ```

   Resolve any reported errors before treating a build as release-ready.

## Build both Android APKs

### Development APK

This APK contains `expo-dev-client` and is intended for active development. It needs a reachable Metro server to load the JavaScript bundle:

```bash
npx eas-cli@latest build --platform android --profile development
npx expo start --dev-client
```

Install the APK on the Android device, then connect it to the development server (same Wi-Fi network, or use a tunnel).

### Standalone preview APK

This APK embeds the JavaScript bundle and can be opened without a running development server:

```bash
npx eas-cli@latest build --platform android --profile preview
```

When the build finishes, open the build page or APK URL on the Android phone and install it. Android may ask you to allow installation from that browser/file manager.

### Production Android App Bundle

For Google Play:

```bash
npx eas-cli@latest build --platform android --profile production
```

The production profile creates an AAB, which is the preferred Play Store format.

## Important notes

- A free Expo account is sufficient to link the project and start eligible EAS builds; build concurrency and quotas depend on the current Expo plan.
- The first EAS build may ask to generate Android signing credentials. Let EAS manage the keystore unless you already have a release keystore that must be preserved.
- Never commit Expo access tokens, keystores, passwords, or private signing credentials.
- The development APK is not a standalone consumer build: it requires the Metro development server. Use the preview APK for normal app testing.
- EAS project linking is intentionally not committed yet because it requires the owner's Expo account and writes a project-specific ID to app configuration.
- iOS device builds require Apple signing credentials and an Apple Developer account for distribution. The Android profiles above do not configure iOS signing.
