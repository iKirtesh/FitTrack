# Build FitTrack APK from an Android phone

The repository now includes a GitHub Actions workflow at `.github/workflows/android-apk.yml`. You can trigger an Android APK build from the GitHub mobile app or mobile browser; you do not need a laptop.

## One-time setup

### 1. Create an Expo access token

1. Open https://expo.dev/settings/access-tokens while signed in.
2. Create a personal access token named `FitTrack GitHub Actions`.
3. Copy it. Treat it like a password. Do not paste it into a chat, issue, commit, or workflow file.

### 2. Add the token to GitHub

1. Open https://github.com/iKirtesh/FitTrack/settings/secrets/actions
2. Under **Repository secrets**, choose **New repository secret**.
3. Name: `EXPO_TOKEN`
4. Value: paste the Expo token and save.

### 3. Add your Expo account username as a repository variable

1. Open https://github.com/iKirtesh/FitTrack/settings/variables/actions
2. Under **Repository variables**, choose **New repository variable**.
3. Name: `EXPO_ACCOUNT`
4. Value: your Expo account username (not your email address).
5. Save.

The workflow uses this token to create or link the EAS project under your Expo account. It does not require an EAS project ID to be copied manually.

## Build an APK from your phone

1. Open https://github.com/iKirtesh/FitTrack/actions
2. Select **Android APK**.
3. Tap **Run workflow**.
4. For the branch, select `chore/android-build-preparation` until this branch is merged to `main`.
5. Choose **preview** for a normal installable APK, or **development** for a developer-client APK.
6. Tap **Run workflow** and open the running job to follow the build.

When EAS finishes, open the build link in the job log or the Expo build page and download the APK to your Android phone.

## Which build should I choose?

- **Preview**: the recommended first APK to install and test the app.
- **Development**: includes the Expo development client and is intended for ongoing development; it is not the normal end-user build.

## Notes

- The first build can take several minutes.
- The build is performed by Expo EAS in the cloud.
- This workflow does not publish the app to Google Play.
- Keep the Expo token private. If it is exposed, revoke it from the Expo access-token settings and replace the GitHub secret.
