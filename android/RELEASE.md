# Android release and signing

## Build variants

- Debug installs as `et.tenderlink.app.debug` and uses the development API URL.
- Release installs as `et.tenderlink.app` and uses the pre-release API URL.
- Both API URLs and the App Link host can be overridden with Gradle properties or matching environment variables.
- Version defaults to code `1` and name `1.0.0`; override with `TENDERLINK_VERSION_CODE` and `TENDERLINK_VERSION_NAME`.
- The release App Bundle includes English and Amharic strings in the base bundle; density and ABI splits are enabled.
- Full native debug symbols are configured for Play Console symbolication.

## Create and protect the upload key

Run locally (do not upload or commit the keystore):

```bash
keytool -genkey -v -keystore android/app/upload-keystore.jks \\
  -keyalg RSA -keysize 2048 -validity 10000 -alias tenderlink-upload
cp android/keystore.properties.example android/keystore.properties
```

Edit `android/keystore.properties` with the actual credentials. Keep encrypted backups of the keystore and credentials in separate secure locations. Never commit either file.

For CI, supply these secrets instead of the local properties file:

- `ANDROID_KEYSTORE_PATH`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

The keystore path in CI must point to a file made available to the job from a protected secret or secure artifact. Do not put secret values in Gradle properties or repository files.

## Build and verify

From the `android/` directory, run tests and build the Play App Bundle:

```bash
./gradlew testDebugUnitTest
./gradlew :app:bundleRelease \\
  -PTENDERLINK_API_BASE_URL=https://ais-pre-htodhr45yu6y7b2qutgygv-671794884453.europe-west2.run.app/ \\
  -PTENDERLINK_APP_LINK_HOST=ais-pre-htodhr45yu6y7b2qutgygv-671794884453.europe-west2.run.app \\
  -PTENDERLINK_VERSION_CODE=1 \\
  -PTENDERLINK_VERSION_NAME=1.0.0
```

The Play bundle is written to `android/app/build/outputs/bundle/release/app-release.aab`. Release signing is used only when the required credentials are configured; verify the bundle's signature before uploading it to Play Console.

To switch App Links to your custom domain when it is live, set `TENDERLINK_APP_LINK_HOST=tenderlink.et`. Verified App Links also require the backend to serve a valid `/.well-known/assetlinks.json` containing the Google Play App Signing certificate fingerprint. Debug builds use a distinct application ID and are not listed in Play Store asset links.
